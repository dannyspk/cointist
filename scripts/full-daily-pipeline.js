#!/usr/bin/env node
/*
  Full pipeline orchestrator:
  - Read aggregator (tmp/trending-aggregator-last.json) or use --in
  - Filter social items (X/Twitter, Reddit)
  - Scrape top N articles and extract main content
  - Rephrase & format as HTML using OpenAI if OPENAI_API_KEY is set, otherwise use a safe template
  - Upsert articles into Prisma DB (optionally publish with --publish)
  - Fetch matching Pexels images (if PEXELS_API_KEY set) and attach coverImage/thumbnail

*/
const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')
const { JSDOM } = require('jsdom')
const argv = require('minimist')(process.argv.slice(2))
const readline = require('readline')
const sharp = require('sharp')
// Prefer Supabase when SUPABASE_URL + KEY are set, otherwise fall back to Prisma
let prisma = null
let supa = null
try{
  const { createClient } = require('@supabase/supabase-js')
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (SUPA_URL && SUPA_KEY) {
    supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    console.log('[pipeline] using Supabase for storage')
  }
}catch(e){ /* supabase not available */ }
if (!supa) {
  try{
    const { PrismaClient } = require('@prisma/client')
    prisma = new PrismaClient()
    console.log('[pipeline] using Prisma for storage')
  }catch(e){
    prisma = null
  }
}

const { extractKeywords } = require('../src/utils/keywords')

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
const PEXELS_KEY = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY
// opt-in: generate images via OpenAI when other sources fail
const GEN_IMAGES = !!argv.genImages || !!argv['gen-images']
// image provider selection: 'auto' (try OpenAI then Modelslab), 'openai', or 'modelslab'
const IMAGE_PROVIDER = (argv.imageProvider || argv['image-provider'] || 'auto').toString().toLowerCase()
// Modelslab fallback API key (user-provided)
const MODELSLAB_KEY = process.env.MODELSLAB_API_KEY || process.env.MODELSLAB_KEY

const IN_PATH = argv.in || './tmp/trending-aggregator-last.json'
// limit per-batch to 5 to avoid processing too many at once
const COUNT = Math.min(Number(argv.count || 5), 5)
const RUNS = Number(argv.runs || 1)
const INTERVAL_MIN = Number(argv.intervalMinutes || 480) // default 8 hours
const PUBLISH = !!argv.publish

// If the aggregator output is missing or stale, optionally refresh it by running
// the aggregator script. Default max age is 60 minutes but can be overridden
// with --maxAgeMinutes or --maxAge. Pass --no-refresh to disable automatic refresh.
const { execSync } = require('child_process')
const MAX_AGE_MIN = Number(argv.maxAgeMinutes || argv.maxAge || 60)
const DISABLE_REFRESH = !!argv['no-refresh']

function refreshAggregatorIfStale(){
  if (DISABLE_REFRESH) return
  try{
    const absPath = path.resolve(IN_PATH)
    let needFetch = false
    if (!fs.existsSync(absPath)) {
      console.log('[pipeline] aggregator file not found, will fetch fresh feed ->', IN_PATH)
      needFetch = true
    } else {
      const st = fs.statSync(absPath)
      const ageMin = (Date.now() - st.mtimeMs) / 60000
      if (ageMin > MAX_AGE_MIN) {
        console.log(`[pipeline] aggregator file is ${Math.round(ageMin)} minutes old (> ${MAX_AGE_MIN}) — refreshing feed`)
        needFetch = true
      }
    }
    if (needFetch) {
      // call the aggregator script shipped with the repo; pass hours from argv or default 6
      const hours = Math.max(1, Number(argv.hours || 6))
      const cmd = `node ${path.join('scripts','fetch-trending-aggregator.js')} --out=${IN_PATH} --hours=${hours}`
      console.log('[pipeline] running:', cmd)
      // run synchronously so subsequent code reads the fresh file
      try {
        execSync(cmd, { stdio: 'inherit' })
        // After the aggregator completes, verify the output file and print a concise summary
        try {
          if (fs.existsSync(absPath)) {
            const raw = fs.readFileSync(absPath, 'utf8')
            try {
              const parsed = JSON.parse(raw)
              const count = Array.isArray(parsed) ? parsed.length : (parsed && parsed.length) || 0
              console.log(`[pipeline] aggregator refreshed: wrote ${count} items to ${IN_PATH}`)
            } catch (e) {
              const st = fs.statSync(absPath)
              console.log(`[pipeline] aggregator refreshed: output file present at ${IN_PATH} (size=${st.size} bytes)`)
            }
          } else {
            console.error('[pipeline] aggregator refresh completed but output file not found:', IN_PATH)
          }
        } catch (e) {
          console.error('[pipeline] aggregator post-check failed:', e && e.message)
        }
      } catch (e) {
        console.error('[pipeline] aggregator command failed:', e && e.message)
        throw e
      }
    }
  }catch(e){ console.error('[pipeline] aggregator refresh failed:', e && e.message) }
}

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)) }

function askYesNo(question){
  return new Promise((resolve)=>{
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question + ' (y/N): ', ans => { rl.close(); const ok = /^y(es)?$/i.test((ans||'').trim()); resolve(!!ok) })
  })
}

function textFromNode(node){ if(!node) return ''; return node.textContent.replace(/\s+/g,' ').trim() }

function isSocialSourceItem(item){
  try{ const u=new URL(item.url); const host=(u.hostname||'').toLowerCase(); if(host.includes('reddit')) return true; if(host==='x.com' || host.includes('x.com')) return true; if(host.includes('twitter')||host==='t.co'||host.includes('t.co')) return true }catch(e){}
  const src = (item.source||'').toString().toLowerCase()
  if(!src) return false
  if(src.includes('reddit')) return true
  if(src.includes('twitter')||src==='x') return true
  if(src.includes('x.com')) return true
  return false
}

async function fetchAndExtract(url){
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'cointist-pipeline/1.0' }, timeout: 20000 })
    if(!res.ok) return { url, error: `HTTP ${res.status}` }
    const html = await res.text()
    const dom = new JSDOM(html); const doc = dom.window.document
    // attempt to find a lead image: og:image, twitter:image, or first <img>
    let leadImage = null
    try{
      const og = doc.querySelector('meta[property="og:image"]') || doc.querySelector('meta[name="og:image"]')
      const tw = doc.querySelector('meta[name="twitter:image"]')
      if (og && og.getAttribute('content')) leadImage = og.getAttribute('content')
      else if (tw && tw.getAttribute('content')) leadImage = tw.getAttribute('content')
      else {
        const firstImg = doc.querySelector('img')
        if (firstImg && firstImg.getAttribute('src')) leadImage = firstImg.getAttribute('src')
      }
      // normalize relative URLs
      if (leadImage) {
        try{ leadImage = new URL(leadImage, url).toString() }catch(e){}
      }
    }catch(e){ /* ignore leadImage extraction errors */ }
    const selectors = ['article','main','[role="main"]','.article-content','.post-content','.entry-content','.content','#content','.story-body']
  for(const sel of selectors){ const el = doc.querySelector(sel); if(el){ const text = textFromNode(el); if(text && text.length>200) return { url, content: text, selector: sel, leadImage } } }
    const pNodes = Array.from(doc.querySelectorAll('p'))
    if(pNodes.length){ const blocks = new Map(); pNodes.forEach(p=>{ const key = p.parentElement ? p.parentElement.outerHTML.slice(0,200) : 'root'; const prev = blocks.get(key)||[]; prev.push(p); blocks.set(key, prev) }); let best={text:'',size:0}; blocks.forEach((ps)=>{ const txt = ps.map(p=>textFromNode(p)).join('\n\n'); if(txt.length>best.size) best={text:txt,size:txt.length} }); if(best.size>200) return { url, content: best.text, selector: 'p-block' } }
  const bodyText = textFromNode(doc.body || doc.documentElement)
  return { url, content: bodyText.slice(0,2000), selector: 'body-fallback', leadImage }
  }catch(e){ return { url, error: e && e.message || String(e) } }
}

function sanitizeFilename(s){ return s.replace(/[^a-z0-9-_]/gi,'-').replace(/-+/g,'-').toLowerCase() }

// Normalize article titles by removing common publisher suffixes and extra whitespace
function normalizeTitle(t){
  if(!t) return ''
  try{
    // strip trailing " - Cointelegraph", " — CoinDesk", etc and collapse whitespace
    return String(t).replace(/\s*[-–—]\s*(Cointelegraph|Cointelegraph.com|CoinDesk|Coin Desk)\b.*$/i, '').replace(/\s+/g,' ').trim()
  }catch(e){ return String(t||'').trim() }
}

// Create a short contextual blockquote based on scraped content, excerpt, or title.
async function generateBlockquote(item, scraped, articleData){
  // Sanitize and pick a human-readable sentence for the blockquote, then HTML-escape it.
  function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }
  try{
    let raw = ''
    if(scraped && scraped.content){
      // remove script-like fragments and long code snippets
      raw = scraped.content.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,' ')
      raw = raw.replace(/https?:\/\/[^\s]+/gi,' ')
      raw = raw.replace(/\{[\s\S]*?\}|\([^\)]*\)|\[.*?\]/g,' ')
      raw = raw.replace(/[=<>]{2,}|=>|\bfunction\b|\bvar\b|\bconst\b|\bwindow\b|\bdocument\b/gi,' ')
      // remove other non-word symbols but keep basic punctuation
      raw = raw.replace(/[^\w\s\.\,\-\'\"\!\?]/g,' ')
      // remove tokens that look like minified code (short tokens with many non-alpha chars)
      raw = raw.replace(/\b[\w]{1,2}\b/g,' ')
      raw = raw.replace(/\s+/g,' ').trim()
      // detect clearly noisy content (minified JS, heavy punctuation, tokens)
      const alphaOnly = raw.replace(/[^a-zA-Z\s]/g,'')
      const alphaWordCount = (alphaOnly.split(/\s+/).filter(Boolean)).length
      const noisePatterns = /wiz_tick|use strict|function\(|window\.|document\.|var\s+|=>|\(function\(|\bconsole\b|\breturn\b/i
      if(alphaWordCount < 6 || noisePatterns.test(raw) || (raw.length < 80 && alphaWordCount < 12)){
        raw = '' // treat as noisy and fall back later
      }
    }
    // split into sentences
    const sentences = (raw && raw.match(/[^.!?]+[.!?]?/g)) || []
    let quote = ''
    // named-entity heuristics: two or more consecutive capitalized words, or org patterns
    const neRegex = /(?:\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b)|\b(Inc|Ltd|LLC|Corp|Corporation|University|Bank|Foundation|Institute|Group)\b/gi
    // first try: pick a sentence containing a named entity and reasonable length
    for(const s of sentences){
      const t = s.trim()
      const words = (t.split(/\s+/).filter(w=>/[a-zA-Z]/.test(w)))
      if(words.length >= 4 && t.length >= 40 && t.length <= 240 && neRegex.test(t)) { quote = t; break }
    }
    // second tier: pick a clean sentence with 4+ words
    if(!quote){
      for(const s of sentences){
        const t = s.trim()
        const words = (t.split(/\s+/).filter(w=>/[a-zA-Z]/.test(w)))
        if(words.length >= 4 && t.length >= 60 && t.length <= 240 && /[a-zA-Z]/.test(t) && !/[{}<>\=\*\/\\]/.test(t)) { quote = t; break }
      }
    }
    // third: pick any alphabetic sentence
    if(!quote){ quote = sentences.find(s=>/[a-zA-Z]/.test(s)) || '' }
    // Fallbacks
    if(!quote && articleData && articleData.excerpt) quote = articleData.excerpt.split(/\.|\n/)[0].trim()
    if(!quote && item && item.title) quote = item.title
    if(!quote) quote = 'Key developments and insights from this story.'
    quote = quote.replace(/\s+/g,' ').trim()
    if(!/[.!?]$/.test(quote)) quote = quote + '.'
    // prefer an OpenAI-crafted, context-aware quote when available
    if(OPENAI_KEY){
      const ai = await callOpenAIQuote(articleData.title || item.title || '', raw || articleData.excerpt || '', item.source || item.url || '')
      if(ai && ai.length) quote = ai
    }
    // normalize/remove ellipses and repeated dots in the quote
    quote = (quote || '').replace(/(\.{2,}|…)/g, '.')
    // choose an adaptive author label based on content
    const FOOTER_ROLES = ['Senior industry analyst','Policy expert','Industry expert','Company spokesperson','CTO']
    const textForNE = ((scraped && scraped.content) || articleData.content || item.title || '')
    // try to find a person name (two or three capitalized words)
    const personMatches = (textForNE.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g) || []).filter(Boolean)
    let footer = ''
    if(personMatches.length){
      // prefer a match that is not the article title
      footer = personMatches.find(p => p.trim().toLowerCase() !== (item.title||'').trim().toLowerCase()) || personMatches[0]
    } else {
      // look for organization mentions
      const orgRegex = /(Interpol|Federal Reserve|Fed|IMF|World Bank|SEC|FBI|United Nations|UN|Forbes|CoinDesk|Binance|Coinbase|Citigroup|Google|Microsoft|Bank|Exchange|Ministry|Department|Agency|Committee|Institute|University|Company|Group|Inc|Ltd|Corp)/i
      const orgMatch = textForNE.match(orgRegex)
      if(orgMatch){
        let orgName = orgMatch[1] || orgMatch[0]
        orgName = orgName.replace(/\b(Inc|Ltd|Corp|LLC)\b/gi,'').trim()
        const enforcement = /(Interpol|FBI|SEC|Federal Reserve|Fed|IMF|World Bank|Department|Ministry|Agency|Committee|United Nations|UN)/i
        const companyLike = /\b(Bank|Exchange|Company|Group|Inc|Ltd|Corp|Corporation)\b/i
    if(enforcement.test(orgName)) footer = `${orgName} spokesperson`
    else if(companyLike.test(orgName)) footer = `${orgName} spokesperson`
    else footer = 'Industry expert'
      } else {
        footer = FOOTER_ROLES[Math.floor(Math.random()*FOOTER_ROLES.length)]
      }
    }
  // Capitalize first letter of footer (author label)
  footer = (footer||'').toString().trim()
  if(footer.length) footer = footer.charAt(0).toUpperCase() + footer.slice(1)
  return `<blockquote class="generated-quote"><p>${escapeHtml(quote)}</p><p class="quote-author">${escapeHtml('— ' + footer)}</p></blockquote>`
  }catch(e){ return `<blockquote class="generated-quote"><p>Important context from the article.</p><p class="quote-author">— Cointist</p></blockquote>` }

}

// Async helper to craft a one-sentence quote via OpenAI. Returns text or null on failure.
async function callOpenAIQuote(title, content, source){
  if(!OPENAI_KEY) return null
  const prompt = `Write a single-sentence, publication-ready quote (30-120 characters) that captures the key insight of this article. Write in the voice of a senior industry analyst or policy expert: concise, authoritative, and non-promotional. Do not attribute the quote to any named outlet or author; the site will show a generic analyst footer.\nTitle: ${title}\nContent excerpt:\n${(content||'').slice(0,1200)}`
  try{
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 120 })
    })
    if(!res.ok) return null
    const json = await res.json()
    const text = (json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].text)) || ''
    return (text||'').trim().replace(/^"|"$/g,'')
  }catch(e){ return null }
}

async function callOpenAIRephrase(title, sourceUrl, scrapedContent){
  if(!OPENAI_KEY) return null
  const prompt = `Ensure the title is long and just a light variation of the original. Rephrase the following article into an original, publication-ready HTML article of at least 300 words. Use author name "Cointist". Keep the core facts and context, but rewrite in original language. Return proper opening HTML tags and closing tags at the end. Apart from that the article can start directly with blockquotes and apart from that with paragraphs, and subheadings as needed. Don't include a footer in the end. Provide a short excerpt (1-2 sentences) \nTitle: ${title}\nSource: ${sourceUrl}\nContent excerpt:\n${scrapedContent.slice(0,1500)}\n\nRespond in English.`

  try{
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 1200 })
    })
    if(!res.ok){ console.error('OpenAI error', res.status, res.statusText); return null }
    const json = await res.json()
    const text = (json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].text)) || ''
    // sanitize OpenAI output: strip outer html/body wrappers and stray 'html' tokens
    let textOut = (text || '')
    try{
      const m = textOut.match(/<html[\s\S]*?<body[\s\S]*?>([\s\S]*)<\/body>\s*<\/html>/i)
      if(m && m[1]) textOut = m[1]
      const m2 = textOut.match(/<html[\s\S]*?>([\s\S]*)<\/html>/i)
      if(m2 && m2[1]) textOut = m2[1]
      textOut = textOut.replace(/^\s*html\s*/i,'').replace(/\s*html\s*$/i,'')
    }catch(e){}
    const titleMatch = textOut.match(/<h2[^>]*>(.*?)<\/h2>/i)
    let articleTitle = (titleMatch && titleMatch[1]) || (title + ' — Rewritten')
    // avoid generic 'Article' title produced by some models; prefer source title if detected
    if(/^(article|article\s*)$/i.test(articleTitle.trim())) articleTitle = title
    const excerptMatch = textOut.match(/<p[^>]*>(.*?)<\/p>/i)
    const excerpt = (excerptMatch && excerptMatch[1]) || (scrapedContent.split('\n').slice(0,2).join(' ').slice(0,200))
    const content = textOut
    return { title: articleTitle, excerpt, content }
  }catch(e){ console.error('OpenAI call failed', e && e.message); return null }
}

async function searchPexelsAndAttach(article){
  if(!PEXELS_KEY) {
    // no Pexels key configured — fallback will be attempted by caller
    return null
  }
  const keywords = extractKeywords(article.title || article.slug || '', { max: 6, minLength: 3 })
  for(const kw of keywords){
    try{
      const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(kw)}&per_page=15`
      const res = await fetch(url, { headers: { Authorization: PEXELS_KEY } })
      if(!res.ok) continue
      const json = await res.json(); const photos = json.photos || []
      if(!photos.length) continue
      // prefer the widest usable photo with reasonable size
      const photo = photos.find(p => p.width && p.width >= 800) || photos[0]
      const src = photo.src && (photo.src.large2x || photo.src.large || photo.src.original || photo.src.medium)
      if(!src) continue
      const bufRes = await fetch(src); if(!bufRes.ok) continue
      const buf = Buffer.from(await bufRes.arrayBuffer())
      const base = `article-${article.id || sanitizeFilename(article.slug||article.title).slice(0,12)}-pexels-${photo.id}-${sanitizeFilename(kw)}`
      const OUT_DIR = path.join(process.cwd(),'public','assets'); if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true})
      const fullRel = `/assets/${base}-1200w.jpg`; const thumbRel = `/assets/${base}-96sq.jpg`
      const fullPath = path.join(OUT_DIR, base + '-1200w.jpg'); const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')
      await sharp(buf).resize({ width: 1200 }).jpeg({ quality: 82 }).toFile(fullPath)
      await sharp(buf).resize(96,96,{fit:'cover'}).jpeg({ quality: 82 }).toFile(thumbPath)
      // attach to DB
      try{
        if (supa) {
          const { data, error } = await supa.from('Article').update({ coverImage: fullRel, thumbnail: thumbRel }).eq('id', article.id).select()
          if (error) console.debug('Supabase attach error', JSON.stringify(error, null, 2))
          else console.log('Supabase attached image for', article.id, fullRel)
        } else if (prisma) {
          await prisma.article.update({ where: { id: article.id }, data: { coverImage: fullRel, thumbnail: thumbRel } })
          console.log('Prisma attached image for', article.id, fullRel)
        }
      }catch(e){ console.debug('Attach update failed', e && e.message) }
      return { full: fullRel, thumb: thumbRel, keyword: kw }
    }catch(e){ console.debug('Pexels error', e && e.message); continue }
  }
  return null
}

// Unsplash fallback: similar to Pexels but uses Unsplash API when configured
async function searchUnsplashAndAttach(article){
  const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_KEY
  if(!UNSPLASH_KEY) return null
  const keywords = extractKeywords(article.title || article.slug || '', { max: 6, minLength: 3 })
  for(const kw of keywords){
    try{
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(kw)}&per_page=15`
      const res = await fetch(url, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } })
      if(!res.ok) continue
      const json = await res.json(); const photos = json.results || []
      if(!photos.length) continue
      const photo = photos.find(p => p.width && p.width >= 800) || photos[0]
      const src = photo && (photo.urls && (photo.urls.full || photo.urls.regular || photo.urls.raw || photo.urls.small))
      if(!src) continue
      const bufRes = await fetch(src); if(!bufRes.ok) continue
      const buf = Buffer.from(await bufRes.arrayBuffer())
      const base = `article-${article.id || sanitizeFilename(article.slug||article.title).slice(0,12)}-unsplash-${photo.id}-${sanitizeFilename(kw)}`
      const OUT_DIR = path.join(process.cwd(),'public','assets'); if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true})
      const fullRel = `/assets/${base}-1200w.jpg`; const thumbRel = `/assets/${base}-96sq.jpg`
      const fullPath = path.join(OUT_DIR, base + '-1200w.jpg'); const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')
      await sharp(buf).resize({ width: 1200 }).jpeg({ quality: 82 }).toFile(fullPath)
      await sharp(buf).resize(96,96,{fit:'cover'}).jpeg({ quality: 82 }).toFile(thumbPath)
      // attach to DB
      try{
        if (supa) {
          const { data, error } = await supa.from('Article').update({ coverImage: fullRel, thumbnail: thumbRel }).eq('id', article.id).select()
          if (error) console.debug('Supabase attach (unsplash) error', JSON.stringify(error, null, 2))
          else console.log('Supabase attached image (unsplash) for', article.id, fullRel)
        } else if (prisma) {
          await prisma.article.update({ where: { id: article.id }, data: { coverImage: fullRel, thumbnail: thumbRel } })
          console.log('Prisma attached image (unsplash) for', article.id, fullRel)
        }
      }catch(e){ console.debug('Attach update failed (unsplash)', e && e.message) }
      return { full: fullRel, thumb: thumbRel, keyword: kw }
    }catch(e){ console.debug('Unsplash error', e && e.message); continue }
  }
  return null
}

// OpenAI Images fallback (opt-in). Generates one image (b64) and saves local assets, then updates DB.
async function callOpenAIImageAndAttach(article){
  if(!OPENAI_KEY) return null
  try{
  // configurable number of variations (default 5)
  const variations = Math.min(8, Math.max(1, Number(argv.imageVariations || argv['image-variations'] || 5)))
  // prefer the article excerpt when available, otherwise fall back to item.excerpt
  const shortExcerpt = (article.excerpt && String(article.excerpt).trim()) || (article.content && String(article.content).split('\n').slice(0,2).join(' ').slice(0,240)) || ''
  // attempt to extract keywords from title + excerpt to help the image generator focus
  const kwSource = `${article.title || ''} ${shortExcerpt || ''}`
  const kws = (extractKeywords ? extractKeywords(kwSource, { max: 6, minLength: 3 }) : []).slice(0,6).join(', ')
  const prompt = `Photorealistic editorial feature photo for a news article.\nTitle: ${article.title}\nExcerpt: ${shortExcerpt}\nKeywords: ${kws}\nStyle: photographic, natural lighting, shallow depth of field when appropriate, neutral/clean background, realistic textures, avoid stylized painting, avoid cartoons.\nCamera hints: 35-85mm focal length, slight bokeh, crisp subject, high dynamic range.\nExclusions: no logos, no watermarks, no brand names, no visible text overlays, no intrusive overlays.\nTone: serious, journalistic, neutral.\nCreate multiple variations and focus on clear composition that conveys the article topic without using trademarked imagery.`

    // note: some OpenAI endpoints return image URLs instead of base64 and do not accept a 'response_format' param
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, n: variations, size: '1024x1024' })
    })
    if(!res.ok){
      let bodyText = ''
      try{ bodyText = await res.text() }catch(e){ bodyText = String(e && e.message) }
      console.debug('OpenAI image API responded', res.status, res.statusText, bodyText)
      return null
    }
    const json = await res.json()
  const items = (json && json.data) || []
    if(!items.length) { console.debug('OpenAI image response empty'); return null }

    const scored = []
    for(const it of items){
      let buf = null
      try{
        if(it && it.b64_json){
          buf = Buffer.from(it.b64_json, 'base64')
        } else if(it && it.url){
          // fetch the returned URL to get image bytes
          try{
            const imgRes = await fetch(it.url)
            if(imgRes && imgRes.ok){ buf = Buffer.from(await imgRes.arrayBuffer()) }
          }catch(e){ /* ignore per-image fetch errors */ }
        }
      }catch(e){ buf = null }
      if(!buf) { scored.push({ buf: null, score: 0 }); continue }
      try{
        // downscale to speed up analysis
        const small = await sharp(buf).resize(256).greyscale().raw().toBuffer({ resolveWithObject: true })
        const data = small.data; const { info } = small
        const len = data.length
        if(!len){ scored.push({ buf, score: 0 }); continue }
        // compute variance (brightness variance)
        let sum = 0
        for(let i=0;i<len;i++){ sum += data[i] }
        const mean = sum / len
        let v = 0
        for(let i=0;i<len;i++){ const d = data[i]-mean; v += d*d }
        const variance = v / len
        // compute simple edge energy via Sobel-like operator
        const w = info.width, h = info.height
        let edgeSum = 0, count = 0
        // simple 3x3 Sobel kernels
        const gx = [-1,0,1,-2,0,2,-1,0,1]
        const gy = [-1,-2,-1,0,0,0,1,2,1]
        for(let y=1;y<h-1;y++){
          for(let x=1;x<w-1;x++){
            let sx = 0, sy = 0
            let k = 0
            for(let ky=-1;ky<=1;ky++){
              for(let kx=-1;kx<=1;kx++){
                const px = x + kx; const py = y + ky
                const idx = py * w + px
                const val = data[idx]
                sx += gx[k] * val; sy += gy[k] * val; k++
              }
            }
            const mag = Math.sqrt(sx*sx + sy*sy)
            edgeSum += mag; count++
          }
        }
        const edgeMean = count ? (edgeSum / count) : 0
        // normalized edge (0..1) where 255 is max possible per-channel value
        const edgeNorm = Math.min(1, edgeMean / 255)
        // combine metrics: variance * (1 + edgeNorm) gives a boost to images with stronger edges
        const score = variance * (1 + edgeNorm)
        scored.push({ buf, score })
  }catch(e){ scored.push({ buf: null, score: 0 }) }
    }
    if(!scored.length) return null
    scored.sort((a,b)=>b.score - a.score)
    const chosen = scored[0].buf
    const base = `article-${article.id || sanitizeFilename(article.slug||article.title).slice(0,12)}-openai-${Date.now()}`
    const OUT_DIR = path.join(process.cwd(),'public','assets'); if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true})
    const fullRel = `/assets/${base}-1200w.jpg`; const thumbRel = `/assets/${base}-96sq.jpg`
    const fullPath = path.join(OUT_DIR, base + '-1200w.jpg'); const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')
    await sharp(chosen).resize({ width: 1200 }).jpeg({ quality: 88 }).toFile(fullPath)
    await sharp(chosen).resize(96,96,{fit:'cover'}).jpeg({ quality: 86 }).toFile(thumbPath)
    try{
      if (supa) {
        const { data, error } = await supa.from('Article').update({ coverImage: fullRel, thumbnail: thumbRel }).eq('id', article.id).select()
        if (error) console.debug('Supabase attach (openai) error', JSON.stringify(error, null, 2))
        else console.log('Supabase attached image (openai) for', article.id, fullRel)
      } else if (prisma) {
        await prisma.article.update({ where: { id: article.id }, data: { coverImage: fullRel, thumbnail: thumbRel } })
        console.log('Prisma attached image (openai) for', article.id, fullRel)
      }
    }catch(e){ console.debug('Attach update failed (openai)', e && e.message) }
    return { full: fullRel, thumb: thumbRel, provider: 'openai' }
  }catch(e){ console.debug('OpenAI image generation error', e && e.message); return null }
}

// Modelslab fallback: use https://modelslab.com/api/v7/images/text-to-image
async function callModelslabImageAndAttach(article){
  if(!MODELSLAB_KEY) return null
  try{
  console.log('[modelslab] called for article', article.id || article.slug)
  const shortExcerpt = (article.excerpt && String(article.excerpt).trim()) || (article.content && String(article.content).split('\n').slice(0,2).join(' ').slice(0,240)) || ''
  const kwSource = `${article.title || ''} ${shortExcerpt || ''}`
  const kws = (extractKeywords ? extractKeywords(kwSource, { max: 6, minLength: 3 }) : []).slice(0,6).join(', ')
  const prompt = `Photorealistic editorial feature photo for: ${article.title}. Excerpt: ${shortExcerpt}. Keywords: ${kws}. No logos, no watermarks, journalistic tone.`
  // allow overriding model and size via CLI flags
  const modelId = argv.modelslabModel || argv['modelslab-model'] || 'imagen-4.0-ultra'
  const width = String(argv.modelslabWidth || argv['modelslab-width'] || 1024)
  const height = String(argv.modelslabHeight || argv['modelslab-height'] || 1024)
  const samples = Number(argv.modelslabSamples || argv['modelslab-samples'] || 2)
  // payload matches example: include key in body and model_id
  const payload = { key: MODELSLAB_KEY, prompt, model_id: modelId, width: width, height: height, samples }
  // log payload summary (dont include the API key in logs)
  try{ console.log('[modelslab] request', { model_id: modelId, width, height, samples, prompt: prompt.slice(0,200) + (prompt.length>200? '…':'' ) }) }catch(e){}
  const res = await fetch('https://modelslab.com/api/v7/images/text-to-image', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': MODELSLAB_KEY }, body: JSON.stringify(payload) })
    if(!res.ok){ let body=''; try{ body = await res.text() }catch(e){} console.debug('Modelslab responded', res.status, res.statusText, body); return null }
    const json = await res.json()
    // write raw response to tmp for debugging
    try{
      const outDebug = path.join(process.cwd(),'tmp', `modelslab-response-${Date.now()}.json`)
      if(!fs.existsSync(path.dirname(outDebug))) fs.mkdirSync(path.dirname(outDebug), { recursive: true })
      fs.writeFileSync(outDebug, JSON.stringify(json, null, 2))
      console.log('[modelslab] raw response written to', outDebug)
    }catch(e){ console.debug('Failed to write modelslab debug file', e && e.message) }
    // modelslab often returns array of artifacts with urls or b64; some flows are async and return job ids
    const artifacts = json && (json.artifacts || json.outputs || json.data) || []
    try{ console.log('[modelslab] returned artifacts:', artifacts.length) }catch(e){}
    // if no artifacts, check for job id/status and return null with hint
    if(!artifacts.length){
      if(json && (json.id || json.job_id || json.task_id || json.status)){
        console.debug('[modelslab] response contains job id/status — the generation may be asynchronous. Response keys:', Object.keys(json).join(','))
      } else {
        console.debug('[modelslab] no artifacts found in response')
      }
      return null
    }
    // prefer urls first, then b64
    let buf = null
    for(const a of artifacts){
      if(a && a.url){ try{ const r = await fetch(a.url); if(r && r.ok){ buf = Buffer.from(await r.arrayBuffer()); break } }catch(e){} }
      if(a && a.b64){ try{ buf = Buffer.from(a.b64, 'base64'); break }catch(e){} }
      if(a && a.base64){ try{ buf = Buffer.from(a.base64, 'base64'); break }catch(e){} }
    }
    if(!buf) return null
    const base = `article-${article.id || sanitizeFilename(article.slug||article.title).slice(0,12)}-modelslab-${Date.now()}`
    const OUT_DIR = path.join(process.cwd(),'public','assets'); if(!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR,{recursive:true})
    const fullRel = `/assets/${base}-1200w.jpg`; const thumbRel = `/assets/${base}-96sq.jpg`
    const fullPath = path.join(OUT_DIR, base + '-1200w.jpg'); const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')
    await sharp(buf).resize({ width: 1200 }).jpeg({ quality: 86 }).toFile(fullPath)
    await sharp(buf).resize(96,96,{fit:'cover'}).jpeg({ quality: 86 }).toFile(thumbPath)
    try{
      if (supa) {
        const { data, error } = await supa.from('Article').update({ coverImage: fullRel, thumbnail: thumbRel }).eq('id', article.id).select()
        if (error) console.debug('Supabase attach (modelslab) error', JSON.stringify(error, null, 2))
        else console.log('Supabase attached image (modelslab) for', article.id, fullRel)
      } else if (prisma) {
        await prisma.article.update({ where: { id: article.id }, data: { coverImage: fullRel, thumbnail: thumbRel } })
        console.log('Prisma attached image (modelslab) for', article.id, fullRel)
      }
    }catch(e){ console.debug('Attach update failed (modelslab)', e && e.message) }
    return { full: fullRel, thumb: thumbRel, provider: 'modelslab' }
  }catch(e){ console.debug('Modelslab image generation error', e && e.message); return null }
}

async function upsertArticleFromScrape(item, scraped){
  const titleForSlug = normalizeTitle(item.title || item.url || '')
  const slugBase = (titleForSlug || item.url || '').toString().toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/(^-|-$)/g,'').slice(0,60)
  let slug = argv.slugPrefix ? `${argv.slugPrefix}-${slugBase}` : slugBase
  let articleData = null
  if(OPENAI_KEY && scraped && scraped.content){
    articleData = await callOpenAIRephrase(item.title||'', item.url||'', scraped.content)
  }
  if(!articleData){
    const excerpt = (scraped && scraped.content) ? scraped.content.split('\n').slice(0,2).join(' ').slice(0,240) : (item.description || item.excerpt || '')
    const contentHtml = `<p>${excerpt}</p>\n  <p>Original source: <a href="${item.url}">${item.source || item.url}</a></p>\n  <section><h3>Source excerpt</h3>\n  <p>${(scraped && scraped.content)? scraped.content.split('\n').slice(0,6).join('\n\n') : ''}</p>\n  </section>\n</article>`
    articleData = { title: item.title || 'Untitled', excerpt: excerpt, content: contentHtml }
  }

  // Ensure each article includes a contextual blockquote. If there's already one, skip.
  if(articleData && articleData.content && !/<blockquote[\s>]/i.test(articleData.content)){
    const bq = await generateBlockquote(item, scraped, articleData)
    // Prefer to insert after the closing </h2> (title). Fall back to after first <p>, otherwise prepend.
    // Remove redundant leading <h2> if it duplicates the article title
    try{
      const leadingH2 = articleData.content.match(/^\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*/i)
      if(leadingH2 && leadingH2[1]){
        const h2Text = leadingH2[1].replace(/\s+/g,' ').trim()
        const normH2 = h2Text.replace(/[^\w\s]/g,'').toLowerCase()
        const normTitle = (articleData.title||'').replace(/[^\w\s]/g,'').toLowerCase()
        if(normH2 === normTitle){
          articleData.content = articleData.content.replace(leadingH2[0], '')
        }
      }
    }catch(e){}

    if(/<\/h2>/i.test(articleData.content)){
      articleData.content = articleData.content.replace(/<\/h2>/i, `</h2>\n  ${bq}`)
    }else if(/<p[^>]*>.*?<\/p>/i.test(articleData.content)){
      articleData.content = articleData.content.replace(/(<p[^>]*>.*?<\/p>)/i, `$1\n  ${bq}`)
    }else{
      articleData.content = `${bq}\n${articleData.content}`
    }
  // remove repeated dots and unicode ellipsis from the HTML body to avoid '...' appearing
  articleData.content = articleData.content.replace(/(\.{2,}|…)/g, '.')
  }

  // If OpenAI rephrased the title, recompute slug from the new title so slugs reflect rewritten titles
  try {
    const titleForSlug2 = normalizeTitle((articleData && articleData.title) ? articleData.title : (item.title || item.url || ''))
    const slugBase2 = (titleForSlug2 || item.url || '').toString().toLowerCase().replace(/[^a-z0-9]+/gi,'-').replace(/(^-|-$)/g,'').slice(0,60)
    const newSlug = argv.slugPrefix ? `${argv.slugPrefix}-${slugBase2}` : slugBase2
    if (newSlug && newSlug !== slug) {
      try { console.log('[pipeline] Recomputed slug from rephrased title:', newSlug, 'old:', slug) } catch(e) {}
      slug = newSlug
    }
  } catch(e) { /* ignore slug recompute errors */ }

  const now = new Date()
  const data = {
    title: articleData.title,
    slug,
    category: item.category || 'News',
    subcategory: item.subcategory || 'latest',
    author: 'Cointist',
    excerpt: articleData.excerpt || null,
    content: articleData.content || null,
    published: !!PUBLISH,
    publishedAt: PUBLISH ? now : null,
  coverImage: articleData.coverImage || item.coverImage || (scraped && scraped.leadImage) || null,
  thumbnail: item.thumbnail || null,
    tags: item.tags || null
  }

  let created = null
  if (supa) {
    try{
      // Create new row and let Postgres assign id via sequence. If slug exists, make it unique.
      let finalSlug = slug
      try{
        const { data: existing, error: existingErr } = await supa.from('Article').select('id,slug').eq('slug', slug).limit(1)
        if (existingErr) console.debug('Supabase select error', existingErr)
        if (existing && existing[0]) {
          finalSlug = `${slug}-${Date.now().toString(36).slice(-6)}`
        }
      }catch(e){ /* ignore */ }

      const dataToInsert = Object.assign({}, data, { slug: finalSlug })
      const { data: insData, error: insErr } = await supa.from('Article').insert([dataToInsert]).select()
      if (insErr) {
        console.debug('Supabase insert error', JSON.stringify(insErr, null, 2))
      } else {
        created = insData && insData[0] ? insData[0] : null
      }

      if (created) {
        try{
          const { data: verData, error: verErr } = await supa.from('ArticleVersion').insert([{ articleId: created.id, title: created.title, excerpt: created.excerpt || null, content: created.content || '', data: { createdAt: created.createdAt } }])
          if (verErr) console.debug('Supabase version create failed', verErr)
        }catch(e){ console.debug('Supabase version create failed', e && e.message) }
      } else {
        console.debug('Skipping ArticleVersion insert: created is null', { slug: finalSlug })
      }
    }catch(e){ console.debug('Supabase insert-flow error', e && e.message) }
  } else if (prisma) {
    try{
      // If the slug already exists, create a new row with a unique slug instead of updating the existing row.
      const existing = await prisma.article.findUnique({ where: { slug } })
      let finalSlug = slug
      if (existing) {
        finalSlug = `${slug}-${Date.now().toString(36).slice(-6)}`
      }
      const createData = Object.assign({}, data, { slug: finalSlug })
      created = await prisma.article.create({ data: createData })
      try{
        await prisma.articleVersion.create({ data: { articleId: created.id, title: created.title, excerpt: created.excerpt || null, content: created.content || '', data: { createdAt: created.createdAt } } })
      }catch(e){}
    }catch(e){ console.debug('Ppirisma create failed', e && e.message) }
  }
  return created
}

async function runOnce(){
  // Ensure the aggregator feed is fresh (will run fetch-trending-aggregator.js when missing/stale)
  refreshAggregatorIfStale()
  if(!fs.existsSync(IN_PATH)){ console.error('Input aggregator not found:', IN_PATH); return }
  const raw = JSON.parse(fs.readFileSync(IN_PATH,'utf8'))
  const filtered = raw.filter(r=>!isSocialSourceItem(r))

  // Filter candidates by recency (default last 4 hours) and optional --search term
  const HOURS = Number(argv.hours || argv.h || 4)
  const nowMs = Date.now()
  const cutoffMs = nowMs - (HOURS * 60 * 60 * 1000)
  function isRecent(item){
    if(!item) return false
    // prefer ISO-like publishedAt; fall back to published timestamp if numeric
    const p = item.publishedAt || item.published || item.pubDate || item.date
    if(!p) return false
    try{
      const d = new Date(p)
      if(!isNaN(d.getTime())) return d.getTime() >= cutoffMs
      // if numeric timestamp
      const n = Number(p)
      if(!Number.isNaN(n)) return n >= cutoffMs
    }catch(e){ }
    return false
  }

  let candidatesPool = filtered.filter(isRecent)
  // support a selection file produced by the UI: --selection=tmp/selection-to-pipeline.json
  let selectedFromFile = null
  if (argv.selection) {
    try {
      const selPath = String(argv.selection)
      if (fs.existsSync(selPath)) {
        const rawSel = fs.readFileSync(selPath, 'utf8')
        const j = JSON.parse(rawSel)
        if (j && Array.isArray(j.selected) && j.selected.length) {
          // support two shapes:
          // - array of objects (legacy): [{ id, title, url, ... }, ...]
          // - array of ids (strings or numbers): ["id1","id2", ...]
          const sel = j.selected
          const ids = sel.map(s => (typeof s === 'string' || typeof s === 'number') ? String(s) : (s && s.id ? String(s.id) : null)).filter(Boolean)
          // map ids to items from the aggregator 'raw' feed when possible
          const mapped = ids.map(id => {
            // try to find the original item in the aggregator feed by id or url/guid
            const found = raw && Array.isArray(raw) && raw.find(r => String(r.id) === id || String(r.guid || r.link || r.url) === id)
            if (found) return found
            // fallback: if original selection provided object for this id, use its fields
            const obj = sel.find(s => (s && ((typeof s === 'string' && s === id) || (s && s.id && String(s.id) === id))))
            if (obj && typeof obj === 'object') return { id: obj.id || id, title: obj.title || obj.slug || id, url: obj.orig_url || obj.url || obj.link || '', source: obj.source || 'selection', publishedAt: obj.publishedAt || new Date().toISOString(), summary: obj.summary || '' }
            // final fallback: create a minimal placeholder (will likely fail to scrape without URL)
            return { id, title: id, url: '', source: 'selection', publishedAt: new Date().toISOString(), summary: '' }
          })
          selectedFromFile = mapped
          console.log('[pipeline] loaded selection file', selPath, 'items=', selectedFromFile.length)
        }
      } else {
        console.log('[pipeline] selection file not found:', argv.selection)
      }
    } catch (e) { console.error('[pipeline] could not read selection file', String(e)) }
  }

  // support --search="term" to filter presented headlines (case-insensitive substring match)
  if (argv.search) {
    const term = String(argv.search).toLowerCase()
    candidatesPool = candidatesPool.filter(c => ((c.title||'') + ' ' + (c.source||'')).toLowerCase().includes(term))
  }

  if (!candidatesPool || candidatesPool.length === 0) {
    console.log(`No recent candidate articles found in the last ${HOURS} hour(s). Falling back to most-recent items from the feed.`)
    // Fallback: prefer items with parseable dates, sorted newest-first; otherwise use original order
    const withDates = filtered.map(i => {
      const p = i.publishedAt || i.published || i.pubDate || i.date
      let ts = null
      try{ const d = new Date(p); if(!isNaN(d.getTime())) ts = d.getTime() }catch(e){}
      return { item: i, ts }
    })
    const sorted = withDates.filter(x => x.ts).sort((a,b) => b.ts - a.ts).map(x => x.item)
    const fallback = sorted.length ? sorted.concat(filtered.filter(f => !sorted.includes(f))).slice(0, 10) : filtered.slice(0, 10)
    candidatesPool = fallback
  }

  // present top 10 headlines and ask which ones to process (max 5)
  const candidates = selectedFromFile ? selectedFromFile : candidatesPool.slice(0, 10)
  if(!candidates || candidates.length === 0){ console.log('No candidate articles found'); return }
  console.log('\nTop candidates:')
  candidates.forEach((t,i)=>{
    const p = t.publishedAt || t.published || t.pubDate || t.date || ''
    let pstr = ''
    try{ const d = new Date(p); pstr = isNaN(d.getTime()) ? String(p) : d.toISOString() }catch(e){ pstr = String(p) }
    console.log(`${i+1}. ${t.title} — ${t.source || ''} (${pstr})`)
  })

  let selectedIndices = []
  // If the UI provided a selection file, auto-select those candidates (non-interactive)
  if (selectedFromFile && selectedFromFile.length) {
    selectedIndices = selectedFromFile.map((s, idx) => idx + 1).slice(0, COUNT)
    console.log('[pipeline] Using selection file: selecting', selectedIndices.join(','))
  }
  // support programmatic selection via --select="1,2,3"
  if (argv.select) {
    const parts = String(argv.select).split(/[\s,]+/).map(s=>parseInt(s,10)).filter(n=>Number.isInteger(n) && n>=1 && n<=candidates.length)
    const unique = Array.from(new Set(parts)).slice(0,5)
    if (unique.length === 0) { console.log('No valid indices parsed from --select — run aborted'); return }
    selectedIndices = unique
    console.log('\n--select mode: selecting indices', selectedIndices.join(','))
  } else if(argv.auto){
    // auto: pick first COUNT (already clamped to <=5)
    selectedIndices = Array.from({length: Math.min(COUNT, candidates.length)}, (_,i)=>i+1)
    console.log('\n--auto mode: selecting indices', selectedIndices.join(','))
  } else {
    // support --select=1,2,3 for non-interactive selection
    if (argv.select) {
      const sel = String(argv.select).split(/[,\s]+/).map(s=>parseInt(s,10)).filter(n=>Number.isInteger(n) && n>=1 && n<=candidates.length)
      if (sel.length) {
        selectedIndices = Array.from(new Set(sel)).slice(0, Math.min(5, candidates.length))
        console.log('\n--select mode: selecting indices', selectedIndices.join(','))
      }
    }
    if (!selectedIndices.length) {
    // ask user which indices to process
    const answer = await new Promise(resolve => {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      rl.question('\nEnter indices of headlines to process (comma-separated, max 5), or press ENTER to cancel: ', ans => { rl.close(); resolve((ans||'').trim()) })
    })
    if(!answer){ console.log('No selection provided — run aborted'); return }
    // parse input
    const parts = answer.split(/[,\s]+/).map(s=>parseInt(s,10)).filter(n=>Number.isInteger(n) && n>=1 && n<=candidates.length)
    const unique = Array.from(new Set(parts))
    if(unique.length === 0){ console.log('No valid indices parsed — run aborted'); return }
    if(unique.length > 5){ console.log('You selected more than 5 articles. Please select up to 5.'); return }
    selectedIndices = unique
    console.log('Selected indices:', selectedIndices.join(','))
  }
  }

  // build list of selected candidate items
  const selectedItems = selectedIndices.map(i => candidates[i-1])
  const scrapedResults = []
  for(const it of selectedItems){ console.error('Scraping', it.url); const scraped = await fetchAndExtract(it.url); scrapedResults.push({ meta: it, scraped }) }
  const upserted = []
  for(const r of scrapedResults){
    const created = await upsertArticleFromScrape(r.meta, r.scraped)
    if(!created){ console.error('Upsert failed for', r.meta && (r.meta.title || r.meta.url)); continue }
    console.log('Upserted', created.id, created.slug)
    upserted.push(created)
    if(PEXELS_KEY) { const p = await searchPexelsAndAttach(created); if(p) console.log('Attached image', p.full) }
  }
  // attempt Unsplash fallback if Pexels not configured or didn't attach
  for(const idx in upserted){ const art = upserted[idx]; if(!art) continue; if(!art.thumbnail || !art.coverImage){ let attached = null; if(!PEXELS_KEY){ attached = await searchUnsplashAndAttach(art) } else if(PEXELS_KEY){ /* if Pexels was used but didn't attach, try Unsplash as fallback */ attached = await searchUnsplashAndAttach(art) } if(attached) console.log('Attached fallback image (unsplash)', attached.full) } }
  // final fallback: opt-in OpenAI image generation
  if (GEN_IMAGES) {
    console.log('[pipeline] imageProvider=', IMAGE_PROVIDER)
    for(const art of upserted){
      if(!art) continue
      if(!art.thumbnail || !art.coverImage){
        let aiAttached = null
        if(IMAGE_PROVIDER === 'openai'){
          if(!OPENAI_KEY) console.debug('imageProvider=openai but OPENAI_API_KEY missing')
          else {
            try{ aiAttached = await callOpenAIImageAndAttach(art) }catch(e){ console.debug('OpenAI image call failed', e && e.message) }
          }
        } else if(IMAGE_PROVIDER === 'modelslab'){
          if(!MODELSLAB_KEY) console.debug('imageProvider=modelslab but MODELSLAB_API_KEY missing')
          else {
            try{ aiAttached = await callModelslabImageAndAttach(art) }catch(e){ console.debug('Modelslab image call failed', e && e.message) }
          }
        } else {
          // auto: try OpenAI first if configured, then Modelslab
          if(OPENAI_KEY){ try{ aiAttached = await callOpenAIImageAndAttach(art) }catch(e){ console.debug('OpenAI image call failed', e && e.message) } }
          if(!aiAttached && MODELSLAB_KEY){ try{ aiAttached = await callModelslabImageAndAttach(art) }catch(e){ console.debug('Modelslab image call failed', e && e.message) } }
        }
        if(aiAttached) console.log('Attached generated image', aiAttached.full, 'provider=', aiAttached.provider)
      }
    }
  }
  // Write pipeline summary atomically: write to a temp file then rename.
  try {
    const outFile = path.join(process.cwd(), 'tmp', `pipeline-summary-${Date.now()}.json`)
    if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true })
    const tmpOut = outFile + '.tmp'
    const payload = { runAt: new Date().toISOString(), count: upserted.length, items: upserted.map(a => ({ id: a.id, slug: a.slug, coverImage: a.coverImage, thumbnail: a.thumbnail, excerpt: a.excerpt })) }
    fs.writeFileSync(tmpOut, JSON.stringify(payload, null, 2), 'utf8')
    fs.renameSync(tmpOut, outFile)
    console.log('Run complete, summary written to', outFile)
  } catch (e) {
    console.error('Failed to write pipeline summary atomically:', e && e.message)
  }
}

;(async()=>{
  for(let i=0;i<RUNS;i++){
    console.log(`\n=== Pipeline run ${i+1}/${RUNS} - ${new Date().toISOString()} ===`)
    try{ await runOnce() }catch(e){ console.error('Run failed', e && e.message) }
    if(i < RUNS-1){ console.log(`Sleeping ${INTERVAL_MIN} minutes before next run`); await sleep(INTERVAL_MIN*60*1000) }
  }
  if (prisma) {
    try{ await prisma.$disconnect() }catch(e){}
  }
  console.log('All runs complete')
})()

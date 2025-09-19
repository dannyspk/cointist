#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')
const fetch = global.fetch || require('node-fetch')
const { JSDOM } = require('jsdom')
const argv = require('minimist')(process.argv.slice(2))
const { spawn } = require('child_process')

// optional Supabase upsert
let supaClient = null
try {
  const { createClient } = require('@supabase/supabase-js')
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (SUPA_URL && SUPA_KEY) supaClient = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
} catch (e) { /* supabase not available */ }

function textFromNode(node){
  try{
    if(!node) return ''
    // clone and remove script/style/iframe/noscript to avoid noisy content
    const clones = node.cloneNode(true)
    const bad = clones.querySelectorAll('script, style, noscript, iframe')
    bad.forEach(n => n.parentNode && n.parentNode.removeChild(n))
    const text = clones.textContent || ''
    return String(text).replace(/\s{2,}/g, ' ').trim()
  }catch(e){ return '' }
}

async function runHeadless(url){
  if(process.env.USE_HEADLESS_FALLBACK !== '1') return null
  // Support optional puppeteer-extra + stealth plugin and proxy configuration
  const useStealth = process.env.USE_PUPPETEER_STEALTH === '1'
  const proxy = process.env.HEADLESS_PROXY || null // e.g. http://user:pass@host:port
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined

  let browser = null
  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-'))
  try{
    if(useStealth){
      let pExtra = null
      let stealthPlugin = null
      try{
        pExtra = require('puppeteer-extra')
        stealthPlugin = require('puppeteer-extra-plugin-stealth')
      }catch(e){
        console.error('puppeteer-extra or stealth plugin not installed. Install with `npm i puppeteer-extra puppeteer-extra-plugin-stealth` to enable stealth fallback.')
        // fall back to vanilla puppeteer
      }
      if(pExtra && stealthPlugin){
        pExtra.use(stealthPlugin())
        const launchOpts = { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'], userDataDir: tmpUserDataDir }
        if(proxy) launchOpts.args = launchOpts.args.concat([`--proxy-server=${proxy.split('@').pop()}`])
        if(execPath) launchOpts.executablePath = execPath
        browser = await pExtra.launch(launchOpts)
      }
    }

    if(!browser){
      // vanilla puppeteer fallback
      const puppeteer = require('puppeteer')
      const launchOpts = { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'], userDataDir: tmpUserDataDir }
      if(proxy) launchOpts.args = launchOpts.args.concat([`--proxy-server=${proxy.split('@').pop()}`])
      if(execPath) launchOpts.executablePath = execPath
      browser = await puppeteer.launch(launchOpts)
    }

    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' })

    // If proxy contains credentials (user:pass@host:port), handle authentication
    if(proxy && proxy.includes('@')){
      try{
        const p = new URL(proxy)
        if(p.username || p.password){
          await page.authenticate({ username: decodeURIComponent(p.username), password: decodeURIComponent(p.password) })
        }
      }catch(e){}
    }

    // Navigate slowly to mimic a real browser more closely
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 })
    const commonSels = ['article','main','[role="main"]','.article-content','.post-content','.entry-content']
    for(const s of commonSels){ try{ await page.waitForSelector(s, { timeout: 3000 }); break }catch(e){} }
    // Capture HTML
    const html = await page.content()
    return html
  }catch(e){
    console.error('Headless fetch failed:', e && (e.message || e))
    return null
  }finally{
    try{ if(browser) await browser.close() }catch(e){}
    try{ fs.rmSync(tmpUserDataDir, { recursive: true, force: true }) }catch(e){}
  }
}

async function fetchAndExtract(url){
  try{
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/',
      // keep original custom header for identification in logs if needed
      'X-Cointist-Scraper': '1'
    };
    const res = await fetch(url, { headers, timeout: 20000 })
    if(!res.ok){
      // If configured, attempt a headless browser fallback to satisfy JS challenges
      if(process.env.USE_HEADLESS_FALLBACK === '1'){
        try{
          const html = await runHeadless(url);
          if(html){
            // parse the fetched HTML from Puppeteer and continue
            const dom = new JSDOM(html)
            const doc = dom.window.document
            // proceed with the normal extraction flow below by reusing doc
            // extract common metadata (title, published date)
            let metaTitle = ''
            try{
              const og = doc.querySelector('meta[property="og:title"]')
              const mt = doc.querySelector('meta[name="title"]')
              if (og && og.getAttribute('content')) metaTitle = String(og.getAttribute('content')||'').trim()
              else if (mt && mt.getAttribute('content')) metaTitle = String(mt.getAttribute('content')||'').trim()
              else if (doc.querySelector('title') && doc.querySelector('title').textContent) metaTitle = String(doc.querySelector('title').textContent||'').trim()
              else if (doc.querySelector('h1') && doc.querySelector('h1').textContent) metaTitle = String(doc.querySelector('h1').textContent||'').trim()
            }catch(e){ metaTitle = '' }
            let publishedAt = null
            try{
              const metaPub = doc.querySelector('meta[property="article:published_time"]') || doc.querySelector('meta[name="pubdate"]') || doc.querySelector('meta[name="publish_date"]') || doc.querySelector('meta[itemprop="datePublished"]')
              if (metaPub && (metaPub.getAttribute('content') || metaPub.getAttribute('value'))) {
                const v = metaPub.getAttribute('content') || metaPub.getAttribute('value')
                const d = new Date(v)
                if (!isNaN(d.getTime())) publishedAt = d.toISOString()
              } else {
                const timeEl = doc.querySelector('time[datetime]')
                if (timeEl && timeEl.getAttribute('datetime')) {
                  const d = new Date(timeEl.getAttribute('datetime'))
                  if (!isNaN(d.getTime())) publishedAt = d.toISOString()
                }
              }
            }catch(e){ /* ignore */ }
            // now run the selector heuristics below using this doc
            // common article selectors (expanded) - add site-specific and generic heuristics
            const selectors = [
              'main .main__content__wrapper',
              'article', 'main', '[role="main"]',
              '.article-content', '.post-content', '.entry-content', '.content', '#content', '.story-body',
              '.article-body', '.article__body', '.article__content', '.news-article', '.newsarticle',
              '.page-content', '.post-article', '.post-article__content', '.entry__content',
              'div[class*="article"]', 'div[class*="content"]'
            ]
            for (const sel of selectors){
              const el = doc.querySelector(sel)
              if (el){
                const text = textFromNode(el)
                if (text && text.length > 200) return { url, content: text, selector: sel, title: metaTitle, publishedAt }
              }
            }
            // fallback grouping logic (same as below)
            try{
              const candidates = Array.from(doc.querySelectorAll('div[class*="article"], section[class*="article"], div[class*="content"], section[class*="content"]'))
              let bestCand = null
              let bestLen = 0
              for(const c of candidates){
                const t = textFromNode(c)
                if(t.length > bestLen){ bestLen = t.length; bestCand = c }
              }
              if(bestCand && bestLen > 200) return { url, content: textFromNode(bestCand), selector: 'largest-candidate', title: metaTitle, publishedAt }
            }catch(e){}
            // fallback paragraph grouping
            const pNodes = Array.from(doc.querySelectorAll('p'))
            if (pNodes.length){
              const blocks = new Map()
              pNodes.forEach(p => {
                const parent = p.parentElement || doc.body
                const prev = blocks.get(parent) || []
                prev.push(p)
                blocks.set(parent, prev)
              })
              let best = { text: '', size: 0, parent: null }
              blocks.forEach((ps, parent) => {
                const txt = ps.map(p => textFromNode(p)).join('\n\n')
                let score = txt.length
                try{
                  const cls = (parent && parent.className) ? String(parent.className).toLowerCase() : ''
                  if (cls.includes('article') || cls.includes('content') || parent.closest && parent.closest('article')) score += 200
                }catch(e){}
                if (score > best.size){ best = { text: txt, size: score, parent } }
              })
              if (best.size > 200) return { url, content: best.text, selector: 'p-block', title: metaTitle, publishedAt }
            }
            const bodyText = textFromNode(doc.body || doc.documentElement)
            return { url, content: bodyText.slice(0, 5000), selector: 'body-fallback', title: metaTitle, publishedAt }
          }
        }catch(e){ /* fall through to diagnostic return below */ }
      }
      // attempt to capture useful diagnostics for debugging blocked requests
      let diag = `HTTP ${res.status}`;
      try{
        const txt = await res.text();
        // limit diagnostic body length
        diag += `\n--- response snippet:\n${txt.slice(0,2000)}`;
      }catch(e){}
      try{
        const rh = {};
        for(const [k,v] of res.headers.entries()) rh[k] = v;
        diag += `\n--- response headers: ${JSON.stringify(rh)}`;
      }catch(e){}
      return { url, error: diag };
    }
    const html = await res.text()
    const dom = new JSDOM(html)
    const doc = dom.window.document
    // extract common metadata (title, published date)
    let metaTitle = ''
    try{
      const og = doc.querySelector('meta[property="og:title"]')
      const mt = doc.querySelector('meta[name="title"]')
      if (og && og.getAttribute('content')) metaTitle = String(og.getAttribute('content')||'').trim()
      else if (mt && mt.getAttribute('content')) metaTitle = String(mt.getAttribute('content')||'').trim()
      else if (doc.querySelector('title') && doc.querySelector('title').textContent) metaTitle = String(doc.querySelector('title').textContent||'').trim()
      else if (doc.querySelector('h1') && doc.querySelector('h1').textContent) metaTitle = String(doc.querySelector('h1').textContent||'').trim()
    }catch(e){ metaTitle = '' }
    let publishedAt = null
    try{
      const metaPub = doc.querySelector('meta[property="article:published_time"]') || doc.querySelector('meta[name="pubdate"]') || doc.querySelector('meta[name="publish_date"]') || doc.querySelector('meta[itemprop="datePublished"]')
      if (metaPub && (metaPub.getAttribute('content') || metaPub.getAttribute('value'))) {
        const v = metaPub.getAttribute('content') || metaPub.getAttribute('value')
        const d = new Date(v)
        if (!isNaN(d.getTime())) publishedAt = d.toISOString()
      } else {
        const timeEl = doc.querySelector('time[datetime]')
        if (timeEl && timeEl.getAttribute('datetime')) {
          const d = new Date(timeEl.getAttribute('datetime'))
          if (!isNaN(d.getTime())) publishedAt = d.toISOString()
        }
      }
    }catch(e){ /* ignore */ }
    // try canonical/og:url first (follow redirects embedded in pages like news.google)
    try{
      const og = doc.querySelector('meta[property="og:url"]') || doc.querySelector('link[rel="canonical"]')
      const href = og && (og.getAttribute('content') || og.getAttribute('href'))
      if(href && href.length && !href.includes('news.google.com')){
        // if canonical points to real article, fetch that instead
        if(href !== url){
          return await fetchAndExtract(href)
        }
      }
    }catch(e){}

    // common article selectors (expanded) - add site-specific and generic heuristics
    const selectors = [
      // site-specific content wrapper for ffnews
      'main .main__content__wrapper',
      'article', 'main', '[role="main"]',
      '.article-content', '.post-content', '.entry-content', '.content', '#content', '.story-body',
      '.article-body', '.article__body', '.article__content', '.news-article', '.newsarticle',
      '.page-content', '.post-article', '.post-article__content', '.entry__content',
      'div[class*="article"]', 'div[class*="content"]'
    ]
  for (const sel of selectors){
      const el = doc.querySelector(sel)
      if (el){
        const text = textFromNode(el)
    if (text && text.length > 200) return { url, content: text, selector: sel, title: metaTitle, publishedAt }
      }
    }
    // Additional heuristic: pick largest continuous container matching article/content-ish classes
    try{
      const candidates = Array.from(doc.querySelectorAll('div[class*="article"], section[class*="article"], div[class*="content"], section[class*="content"]'))
      let bestCand = null
      let bestLen = 0
      for(const c of candidates){
        const t = textFromNode(c)
        if(t.length > bestLen){ bestLen = t.length; bestCand = c }
      }
  if(bestCand && bestLen > 200) return { url, content: textFromNode(bestCand), selector: 'largest-candidate', title: metaTitle, publishedAt }
    }catch(e){}
    // fallback: collect largest continuous <p> block grouped by actual parent element
    const pNodes = Array.from(doc.querySelectorAll('p'))
    if (pNodes.length){
      // group adjacent ps into blocks by their parent element reference (safer than grouping by class/tag)
      const blocks = new Map()
      pNodes.forEach(p => {
        const parent = p.parentElement || doc.body
        const prev = blocks.get(parent) || []
        prev.push(p)
        blocks.set(parent, prev)
      })
      let best = { text: '', size: 0, parent: null }
      blocks.forEach((ps, parent) => {
        const txt = ps.map(p => textFromNode(p)).join('\n\n')
        // boost score if the parent is inside an <article> or has "article"/"content" in className
        let score = txt.length
        try{
          const cls = (parent && parent.className) ? String(parent.className).toLowerCase() : ''
          if (cls.includes('article') || cls.includes('content') || parent.closest && parent.closest('article')) score += 200
        }catch(e){}
        if (score > best.size){ best = { text: txt, size: score, parent } }
      })
  if (best.size > 200) return { url, content: best.text, selector: 'p-block', title: metaTitle, publishedAt }
    }

  const bodyText = textFromNode(doc.body || doc.documentElement)
  return { url, content: bodyText.slice(0, 5000), selector: 'body-fallback', title: metaTitle, publishedAt }
  }catch(e){ return { url, error: e && e.message || String(e) } }
}

async function main(){
  const url = argv.url || argv.u
  const out = argv.out || path.join(process.cwd(),'tmp','source-for-rephrase.txt')
  if(!url){ console.error('Usage: node scripts/fetch_and_dump.js --url <article-url> [--out <path>]'); process.exit(2) }
  try{
    const res = await fetchAndExtract(String(url))
    if(res.error){ console.error('Fetch error:', res.error); process.exit(3) }
    const dir = path.dirname(out)
    if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true})
    const header = `Source: ${res.url}\nSelector: ${res.selector || ''}\n\n`;
    fs.writeFileSync(out, header + (res.content||''), 'utf8')
    console.log('Wrote', out)
      // NOTE: Supabase upsert removed from fetch step. Final HTML upsert is handled by the rephraser.

    // spawn rephraser script to convert extracted content into HTML
    try{
      const rephraser = path.join(process.cwd(), 'scripts', 'web-chatgpt-rephraser.js')
      if (fs.existsSync(rephraser)){
        const safe = String(res.url || url || Date.now()).replace(/[^a-z0-9]/gi,'_').slice(0,80)
        const rephLog = path.join(process.cwd(), 'tmp', `rephraser_${safe}.log`)
        try { if (!fs.existsSync(path.dirname(rephLog))) fs.mkdirSync(path.dirname(rephLog), { recursive: true }); } catch(e) {}
  const rephHeader = `\n=== Spawned rephraser for ${res.url} at ${new Date().toISOString()} script=${process.execPath} ${rephraser} --in=${out} --twoStage invocation=${res.url} ===\n`;
  try { fs.appendFileSync(rephLog, rephHeader, 'utf8'); } catch(e) {}
  const child = spawn(process.execPath, [rephraser, `--in=${out}`, '--twoStage'], { cwd: process.cwd(), windowsHide: true })
        child.stdout.on('data', d => { try { const s = String(d); fs.appendFileSync(rephLog, s, 'utf8'); process.stdout.write(s); } catch(e) {} })
        child.stderr.on('data', d => { try { const s = String(d); fs.appendFileSync(rephLog, s, 'utf8'); process.stderr.write(s); } catch(e) {} })
        child.on('error', err => { try { const s = `\n=== child error=${String(err)} at ${new Date().toISOString()} ===\n`; fs.appendFileSync(rephLog, s, 'utf8'); console.error(s); } catch(e) {} })
        child.on('close', code => { try { const s = `\n=== child exit code=${code} at ${new Date().toISOString()} ===\n`; fs.appendFileSync(rephLog, s, 'utf8'); console.log(s); } catch(e) {} })
        console.log('Spawned rephraser for', res.url)
      } else {
        console.warn('Rephraser script not found; skipping rephrase')
      }
    }catch(e){ console.error('Failed to spawn rephraser', e && e.message ? e.message : e) }
  }catch(e){ console.error('Failed to fetch+extract:', e && e.message); process.exit(4) }
}

if(require.main === module) main()

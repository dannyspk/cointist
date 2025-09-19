#!/usr/bin/env node
/*
  Rephraser (two-stage) - cleaned single-file implementation
  - Uses OPENAI_API_KEY from env
  - Model selection: --model or env OPENAI_MODEL / OPENAI_MODEL_NAME, fallback 'gpt-5'
  - Usage:
      node scripts/web-chatgpt-rephraser.js --text "..."
      node scripts/web-chatgpt-rephraser.js --in ./tmp/source.txt --twoStage
  - Writes output HTML to tmp/rephrase-<ts>.html and prints the path
*/

const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')
const argv = require('minimist')(process.argv.slice(2))
const crypto = require('crypto')

// optional Supabase client for upserting final HTML
let supaClient = null
try {
  const { createClient } = require('@supabase/supabase-js')
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (SUPA_URL && SUPA_KEY) supaClient = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
} catch (e) { /* supabase not available */ }

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
const MODEL = argv.model || process.env.OPENAI_MODEL || process.env.OPENAI_MODEL_NAME || 'gpt-5-mini'

if(!OPENAI_KEY){
  console.error('Missing OpenAI API key. Set OPENAI_API_KEY in env.')
  process.exit(1)
}

async function fetchWithRetry(url, opts = {}, attempts = 3){
  for(let i=0;i<attempts;i++){
    try{
      const res = await fetch(url, opts)
      if(res.ok) return res
      if(res.status === 429 && i < attempts-1){
        const ra = res.headers && (res.headers.get && res.headers.get('Retry-After'))
        const wait = ra ? (Number(ra)*1000 || 1000) : 500 * (2**i)
        await new Promise(r=>setTimeout(r, wait))
        continue
      }
      return res
    }catch(e){ if(i===attempts-1) throw e; await new Promise(r=>setTimeout(r, 300*(i+1))) }
  }
}

function buildPayload({ messages, maxTokens, temperature, n }){
  const useMaxCompletion = /gpt[-_ ]?5/i.test(String(MODEL))
  const tokenKey = useMaxCompletion ? 'max_completion_tokens' : 'max_tokens'
  const p = { model: MODEL, messages }
  if(!useMaxCompletion && typeof temperature !== 'undefined') p.temperature = temperature
  if(!useMaxCompletion && typeof n !== 'undefined') p.n = n
  if(typeof maxTokens !== 'undefined') p[tokenKey] = maxTokens
  return p
}

async function sendOpenAIChat(opts){
  const payload = buildPayload(opts)
  const useResponses = /gpt[-_ ]?5/i.test(String(MODEL))
  if(useResponses){
    const input = (payload.messages || []).map(m => ({ role: m.role, content: m.content }))
    const body = { model: MODEL, input }
    if(typeof opts.maxTokens !== 'undefined') body.max_output_tokens = opts.maxTokens
    const res = await fetchWithRetry('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(body) })
    if(!res.ok){ const txt = await res.text().catch(()=>'<no-body>'); throw new Error('OpenAI Responses API error: '+res.status+' '+txt) }
    const json = await res.json()

    // If the structured Responses output doesn't include text, fall back to chat completions
    const hasText = (json && (typeof json.output_text === 'string' && json.output_text.trim())) || (json && Array.isArray(json.output) && json.output.some(o => (o && (o.text || (o.content && o.content.some(c=>c && c.text))))))
    if(!hasText){
  const fallbackPayload = { model: 'gpt-5-mini', messages: payload.messages }
      const cres = await fetchWithRetry('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(fallbackPayload) })
      if(!cres.ok){ const txt = await cres.text().catch(()=>'<no-body>'); throw new Error('OpenAI fallback chat error: '+cres.status+' '+txt) }
      const cjson = await cres.json()
      return cjson
    }
    return json
  }

  const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(payload) })
  if(!res.ok){ const txt = await res.text().catch(()=>'<no-body>'); throw new Error('OpenAI API error: '+res.status+' '+txt) }
  const json = await res.json()
  return json
}

function readInput(){
  if(argv.in){ const p = path.resolve(String(argv.in)); if(!fs.existsSync(p)) throw new Error('Input file not found: ' + p); return fs.readFileSync(p,'utf8') }
  if(argv.text) return String(argv.text)
  if(!process.stdin.isTTY){ const data = fs.readFileSync(0,'utf8'); if(data && data.trim()) return data }
  throw new Error('No input provided. Use --text or --in <file> or pipe text.')
}

function appendPipelineRunLine(line){
  try{
    const outDir = path.join(process.cwd(),'tmp')
    if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const ts = new Date().toISOString()
  const clean = `${ts} ${String(line).replace(/\r?\n/g,' ')}\n`
  // preferred UI file
  const preferred = path.join(outDir, 'pipeline-run-output.txt')
  // fallback file the UI also checks
  const fallback = path.join(outDir, 'pipeline-run.log')
  // a small per-rephraser file for easier grepping
  const per = path.join(outDir, 'pipeline-rephraser.log')
  try { fs.appendFileSync(preferred, clean, 'utf8') } catch(e) { /* best-effort */ }
  try { fs.appendFileSync(fallback, clean, 'utf8') } catch(e) { /* best-effort */ }
  try { fs.appendFileSync(per, clean, 'utf8') } catch(e) { /* best-effort */ }
  }catch(e){ /* best-effort logging */ }
}

function extractTextFromResponse(json){
  if(!json) return ''
  if(typeof json.output_text === 'string' && json.output_text.trim()) return json.output_text
  if(json.output && Array.isArray(json.output)){
    const parts = []
    for(const o of json.output){
      if(o && o.content && Array.isArray(o.content)){
        for(const c of o.content){ if(c && typeof c.text === 'string') parts.push(c.text) }
      }
      if(o && typeof o.text === 'string') parts.push(o.text)
    }
    if(parts.length) return parts.join('\n\n')
  }
  if(json.choices && Array.isArray(json.choices) && json.choices[0]){
    return (json.choices[0].message?.content || json.choices[0].text || '')
  }
  return ''
}

async function main(){
  try{
    const src = readInput()
    const MAX_IN = Number(argv.maxInputChars || 24000)
    const useSrc = src.length > MAX_IN ? src.slice(0, MAX_IN) : src

  const system = `You are an experienced news editor and copy editor. When rephrasing or rewriting user-provided content, preserve all named entities (people, companies, organizations, tokens, tickers) and numeric facts (amounts, percentages, dates) exactly as given unless the user explicitly asks to change them. Write in a professional, neutral editorial voice with clear narrative flow. Prefer cohesive paragraphs (2-4 sentences) and avoid producing many tiny paragraphs. Use headings sparingly (no more than three <h3> subheadings). Use lists (<ul><li>) only when they improve clarity.`

  const aggressive = !!argv.aggressive
  const baseInstr = `Rewrite the following content into an original, publication-quality HTML news article. Preserve named entities and numeric facts exactly. Maintain the meaning and key facts. Output must include an <h2> title, a concise 1-2 sentence <p> excerpt, and the article HTML in the body.`
  const aggressiveNote = ` When aggressive mode is enabled, rephrase headings, bullets and paragraphs more strongly to avoid verbatim copying, but keep entities and numeric facts unchanged. Do not increase the number of subheadings or shorten paragraphs.`
  const faithfulFlag = !!argv.faithful
  const faithfulNote = faithfulFlag ? ` Preserve paragraph-level coverage: cover all factual points and sections present in the source. Do not omit key examples, levels, dates, or numbers. Maintain paragraph structure (same number of paragraphs per major section) where practical. When using the two-stage outline mode, Stage 1 must produce at least 4 distinct section headings and include every major section from the source (do not copy the source headings verbatim; create new, concise headings that cover the same sections).` : ''
  const user = `${baseInstr}${aggressive ? aggressiveNote : ''}${faithfulNote}\n\nContent:\n${useSrc}`

  console.error('[rephraser] model=', MODEL)
  try{ appendPipelineRunLine(`[rephraser] model= ${MODEL}`) }catch(e){}
    const twoStage = !!argv.twoStage
    let finalText = ''
    let dbgJson = null

    if(twoStage){
      // Stage 1: title + outline
      const stage1Sys = system
      const minOutlineItems = 4
  const stage1User = `Create a new, original H2 title and a concise outline of ${minOutlineItems}-6 short section headings (not granular bullet points) for the article below. Do NOT reuse the article's exact title or replicate exact bullet wording. Preserve named entities and numbers exactly. Ensure the outline covers all major sections and factual points from the source; list at least ${minOutlineItems} headings. Output only the title on the first line, then each section heading on its own line.` + "\n\nSource:\n" + useSrc
      const s1 = await sendOpenAIChat({ messages: [{ role: 'system', content: stage1Sys }, { role: 'user', content: stage1User }], maxTokens: 500, temperature: Number(argv.temperature || 0.8) })
      let s1text = extractTextFromResponse(s1)

      // Validate stage1 outline contains at least minOutlineItems headings; retry once if it doesn't
      try{
        const lines = String(s1text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
        const headings = lines.slice(1)
        if(headings.length < minOutlineItems){
          const retryUser = stage1User + `\n\nNOTE: Your outline must include at least ${minOutlineItems} section headings that cover all major sections of the source. Please rewrite the title and outline now.`
          const s1b = await sendOpenAIChat({ messages: [{ role: 'system', content: stage1Sys }, { role: 'user', content: retryUser }], maxTokens: 600, temperature: Number(argv.temperature || 0.7) })
          const s1btext = extractTextFromResponse(s1b)
          if(s1btext && s1btext.trim()){
            s1text = s1btext
          }
        }
      }catch(e){ /* non-fatal */ }

      // Stage 2: expand into structured HTML (short, readable format)
  const stage2Sys = system
  const stage2User = `Using the title and outline below, write a publication-ready HTML news article. Output must include an <h2> title, a concise 1-2 sentence <p> excerpt, and an <article> body. Structure the article using at most three <h3> subheadings. Each paragraph should be 2-4 sentences (avoid many 1-sentence paragraphs). Prefer flowing narrative over many lists; convert outline points into concise prose or a single short list only if it improves clarity. Preserve named entities and numeric facts exactly. Use a professional editorial tone and avoid over-summarization.\n\nTitle and Outline:\n${s1text}`
  const s2 = await sendOpenAIChat({ messages: [{ role: 'system', content: stage2Sys }, { role: 'user', content: stage2User }], maxTokens: Number(argv.maxTokens || 1400), temperature: Number(argv.temperature || 0.6), n: Number(argv.n || 1) })
      dbgJson = s2
      finalText = extractTextFromResponse(s2)
    }else{
  const json = await sendOpenAIChat({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens: Number(argv.maxTokens || 1400), temperature: Number(argv.temperature || 0.35), n: Number(argv.n || 1) })
      dbgJson = json
      finalText = extractTextFromResponse(json)
    }

  try{ if(/gpt[-_ ]?5/i.test(String(MODEL)) && dbgJson){ const dbgPath = path.join(process.cwd(),'tmp','reph-raw.json'); fs.writeFileSync(dbgPath, JSON.stringify(dbgJson, null, 2), 'utf8'); console.error('[rephraser] wrote raw responses to', dbgPath) } }catch(e){}

    const outDir = path.join(process.cwd(),'tmp')
    if(!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true})
    const outPath = path.join(outDir, `rephrase-${Date.now()}.html`)
    // sanitize finalText: remove code fences like ```html ... ``` if the model wrapped output in a code block
    finalText = String(finalText || '')
      .replace(/^\s*```(?:html)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim()

    // Extract title (<h2>) and first excerpt paragraph (<p>), then drop them from body.
    const stripTags = (s) => String(s||'').replace(/<[^>]+>/g,' ')
    let titleHtml = ''
    let titleText = ''
    let firstPHtml = ''
    let excerptText = ''
    try{
      const h2m = finalText.match(/<h2[^>]*>[\s\S]*?<\/h2>/i)
      if(h2m){
        titleHtml = h2m[0]
        titleText = stripTags(titleHtml).replace(/\s+/g,' ').trim()
      }
      // content after removing h2
      let afterH2 = titleHtml ? finalText.replace(titleHtml,'') : finalText
      const pm = afterH2.match(/<p[^>]*>[\s\S]*?<\/p>/i)
      if(pm){
        firstPHtml = pm[0]
        excerptText = stripTags(firstPHtml).replace(/\s+/g,' ').trim()
      }
    }catch(e){ /* fallbacks below */ }

    // Build body that starts from <article> (remove leading h2 + first p). If no <article>, wrap remaining HTML.
    let bodyHtml = (() => {
      let rest = finalText
      if(titleHtml) rest = rest.replace(titleHtml,'')
      if(firstPHtml) rest = rest.replace(firstPHtml,'')
      rest = String(rest || '').trim()
      const hasArticle = /<article[\s>]/i.test(rest)
      return hasArticle ? rest : (`<article>\n${rest}\n</article>`)
    })()

    // Write only the article body HTML to disk
    fs.writeFileSync(outPath, bodyHtml || '', 'utf8')
    console.log('Wrote rephrase to', outPath)
  try{ appendPipelineRunLine(`Wrote rephrase to ${outPath}`) }catch(e){}

    // Attempt to upsert the final HTML into Supabase articles table
    try {
      if (supaClient) {
        // try to extract source URL from original input (fetch_and_dump writes a header "Source: <url>")
        let sourceUrl = null
        try {
          const headerMatch = String(useSrc || src || '').match(/^Source:\s*(\S+)/m)
          if (headerMatch && headerMatch[1]) sourceUrl = headerMatch[1].trim()
        } catch (e) { sourceUrl = null }

        // derive id: sha1 of sourceUrl when present, otherwise sha1 of content
        const id = crypto.createHash('sha1').update(String(sourceUrl || finalText || Date.now())).digest('hex')
        // title extraction from generated HTML (<h2>) or earlier parsed titleText
        let title = ''
        try {
          if(titleText){ title = titleText }
          else {
            const m = String(finalText || '').match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
            if (m && m[1]) title = m[1].replace(/<[^>]+>/g, '').trim()
          }
        } catch (e) { title = '' }
        const slugify = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,120)
        const slug = title ? slugify(title) : (sourceUrl ? slugify(sourceUrl) : id.slice(0,12))
        // derive oldslug from the original source article title when available in input
        let originalTitle = null
        try {
          const srcText = String(useSrc || src || '')
          const titleTag = srcText.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
          if (titleTag && titleTag[1]) originalTitle = titleTag[1].replace(/<[^>]+>/g,'').trim()
          if (!originalTitle) {
            const h1m = srcText.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
            if (h1m && h1m[1]) originalTitle = h1m[1].replace(/<[^>]+>/g,'').trim()
          }
          if (!originalTitle) {
            // fallback to first non-empty plaintext line
            const plain = srcText.replace(/<[^>]+>/g,'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean)
            if (plain && plain.length) originalTitle = plain[0]
          }
        } catch (e) { /* best-effort extraction */ }
        const oldslugFromSource = originalTitle ? slugify(originalTitle) : null
        // Prefer the first paragraph after <h2> as excerpt; fallback to body text
        const summary = (excerptText && excerptText.trim())
          ? excerptText.slice(0, 360)
          : String(bodyHtml || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 360)

        // Build Article-shaped row matching full-daily-pipeline.js canonical shape
        // Do NOT send a string id into Article (DB expects integer PK). Upsert by slug instead.
        const row = {
          slug,
          title: title || '',
          oldslug: oldslugFromSource,
          category: 'News',
          subcategory: 'latest',
          author: 'Cointist',
          excerpt: summary || null,
          content: bodyHtml || null,
          published: false,
          publishedAt: null,
          coverImage: null,
          thumbnail: null,
          tags: null
        }

  const up = await supaClient.from('Article').upsert([row], { onConflict: 'slug' })
  // Log the full Supabase response for debugging (may include data/error/status)
  try { console.error('Supabase upsert raw response:', JSON.stringify(up && up, null, 2)); appendPipelineRunLine(`Supabase upsert raw response: ${JSON.stringify(up && up)}`) } catch(e) { console.error('Supabase upsert response (non-json)', up); try{ appendPipelineRunLine(`Supabase upsert raw response: ${String(up)}`) }catch(e){} }
        if (up && up.error) {
          console.error('Supabase upsert error (rephraser)', up.error)
        } else {
          // try to read a numeric id returned by the upsert (PostgREST returns inserted rows)
          let returnedId = up && up.data && Array.isArray(up.data) && up.data[0] && (typeof up.data[0].id !== 'undefined') ? up.data[0].id : null
          // If returnedId is null, attempt to query the Article by slug to fetch the numeric id
          let fetchedArticle = null
          if ((returnedId === null || typeof returnedId === 'undefined') && row.slug) {
            try {
              // Request id, slug, title, excerpt explicitly
              const sel = await supaClient.from('Article').select('id,slug,title,excerpt').eq('slug', row.slug).limit(1).maybeSingle()
              try { console.error('Supabase select raw response for slug:', JSON.stringify(sel && sel, null, 2)); appendPipelineRunLine(`Supabase select raw response for slug: ${JSON.stringify(sel && sel)}`) } catch(e) { console.error('Supabase select response (non-json)', sel); try{ appendPipelineRunLine(`Supabase select raw response for slug: ${String(sel)}`) }catch(e){} }
              if (sel && sel.data && (typeof sel.data.id !== 'undefined')) returnedId = sel.data.id
              // also capture the full article row when available
              if (sel && sel.data && typeof sel.data === 'object') fetchedArticle = sel.data
              // some client versions return { data: [ ... ] }
              if (!returnedId && sel && Array.isArray(sel.data) && sel.data[0] && typeof sel.data[0].id !== 'undefined') {
                returnedId = sel.data[0].id
                if (!fetchedArticle) fetchedArticle = sel.data[0]
              }
            } catch (e) {
              console.error('Supabase select by slug failed', e && e.message ? e.message : e)
            }
          }

          console.log('Upserted rephrase to Supabase', { sha: id, id: returnedId })
          try{ appendPipelineRunLine(`Upserted rephrase to Supabase { sha: '${id}', id: ${String(returnedId)} }`) }catch(e){}
          try {
            // Write a pipeline-summary file so the UI knows the pipeline finished
            const outDir = path.join(process.cwd(),'tmp')
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
            const summaryPath = path.join(outDir, `pipeline-summary-${Date.now()}.json`)
            // If we fetched the article, prefer the authoritative fields
            const itemRow = fetchedArticle ? {
              id: returnedId || fetchedArticle.id || null,
              slug: (fetchedArticle && fetchedArticle.slug) || row.slug,
              title: (fetchedArticle && fetchedArticle.title) || row.title || '',
              excerpt: (fetchedArticle && fetchedArticle.excerpt) || row.excerpt || null
            } : { id: returnedId, slug: row.slug, title: row.title || '', excerpt: row.excerpt || null }
            const summary = { count: 1, items: [itemRow], createdAt: new Date().toISOString() }
            fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8')
            // append a short run message to the global pipeline log for visibility
            try { fs.appendFileSync(path.join(outDir, 'pipeline-run-output.txt'), `Run complete, summary written to ${summaryPath}\n`, 'utf8') } catch (e) {}
            // best-effort: update selection from the rephraser log so the selection file reflects latest DB rows
            try {
              const { spawnSync } = require('child_process')
              const updater = path.join(process.cwd(), 'scripts', 'update-selection-from-rephraser-log.js')
              if (fs.existsSync(updater)) {
                // Prefer in-process require to avoid spawn/race issues.
                try {
                  try { appendPipelineRunLine('Attempting in-process require of updater (preferred)') } catch (_) {}
                  require(updater)
                  try { appendPipelineRunLine('In-process updater require succeeded') } catch (_) {}
                } catch (reqErr) {
                  try { appendPipelineRunLine(`In-process updater require failed: ${String(reqErr && reqErr.message ? reqErr.message : reqErr)}`) } catch (_) {}
                  // retry loop to handle potential flush/race where log lines are not yet written
                  const maxAttempts = 5
                  let attempt = 0
                  let ok = false
                  let lastRes = null
                  while (attempt < maxAttempts && !ok) {
                    attempt++
                    try {
                      const res = spawnSync(process.execPath, [updater], { stdio: 'inherit' })
                      lastRes = res
                      // treat status 0 as success
                      if (res && typeof res.status !== 'undefined') {
                        ok = (res.status === 0)
                        try { appendPipelineRunLine(`Updater spawn attempt ${attempt} exit=${String(res.status)}`) } catch (_) {}
                        if (ok) break
                      }
                    } catch (e) {
                      try { appendPipelineRunLine(`Updater spawn attempt ${attempt} threw ${String(e && e.message ? e.message : e)}`) } catch (_) {}
                    }
                    if (!ok && attempt < maxAttempts) {
                      // small backoff before retry; use a short node sleep via spawnSync to avoid async complexity
                      const delay = 200 * attempt
                      try { spawnSync(process.execPath, ['-e', `setTimeout(()=>{}, ${delay})`]) } catch (e) { /* ignore */ }
                    }
                  }
                  if (!ok) {
                    try { appendPipelineRunLine(`Updater spawn failed after ${maxAttempts} attempts, lastRes=${JSON.stringify(lastRes)}`) } catch (_) {}
                  }
                }
              }
            } catch (e) { /* ignore best-effort */ }
              // After attempting to update the selection, write an aggregated run-level pipeline summary
              try {
                const selectedPath = path.join(outDir, 'selected.json')
                if (fs.existsSync(selectedPath)) {
                  try {
                    const selRaw = fs.readFileSync(selectedPath, 'utf8')
                    const sel = JSON.parse(selRaw)
                    const selItems = Array.isArray(sel.items) ? sel.items : (Array.isArray(sel) ? sel : [])
                    if (selItems && selItems.length) {
                      const aggItems = selItems.map(si => ({
                        id: typeof si.id !== 'undefined' ? si.id : (si.id || null),
                        slug: si.slug || si.fields?.slug || si.data?.slug || null,
                        title: si.title || si.fields?.title || si.data?.title || null,
                        excerpt: si.excerpt || si.fields?.excerpt || si.data?.excerpt || null
                      }))
                      const aggSummaryPath = path.join(outDir, `pipeline-summary-${Date.now()}.json`)
                      const aggSummary = { count: aggItems.length, items: aggItems, createdAt: new Date().toISOString() }
                      fs.writeFileSync(aggSummaryPath, JSON.stringify(aggSummary, null, 2), 'utf8')
                      try { fs.appendFileSync(path.join(outDir, 'pipeline-run-output.txt'), `Run complete, aggregated summary written to ${aggSummaryPath}\n`, 'utf8') } catch (e) {}
                      try { appendPipelineRunLine(`Wrote aggregated pipeline summary to ${aggSummaryPath}`) } catch (_) {}
                    }
                  } catch (e) {
                    try { appendPipelineRunLine(`Failed to read/parse selected.json for aggregated summary: ${String(e && e.message ? e.message : e)}`) } catch (_) {}
                  }
                }
              } catch (e) { /* best-effort */ }
          } catch (e) { console.error('Failed to write pipeline summary from rephraser', e && e.message ? e.message : e) }
        }
      }
    } catch (e) {
      console.error('Rephraser Supabase upsert failed', e && e.message ? e.message : e)
    }
  }catch(e){ console.error('Error:', e && e.message); process.exit(2) }
}

if(require.main === module) main()

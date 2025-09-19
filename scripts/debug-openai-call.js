#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')
const argv = require('minimist')(process.argv.slice(2))

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
const MODEL = argv.model || process.env.OPENAI_MODEL || process.env.OPENAI_MODEL_NAME || 'gpt-5-mini'
if(!OPENAI_KEY){ console.error('Missing OPENAI_API_KEY in env'); process.exit(2) }

async function fetchWithRetry(url, opts = {}, attempts = 3){
  for(let i=0;i<attempts;i++){
    try{ const res = await fetch(url, opts); if(res.ok) return res; if(res.status===429 && i<attempts-1){ const ra = res.headers && res.headers.get && res.headers.get('Retry-After'); const wait = ra ? (Number(ra)*1000||1000) : 500*(2**i); await new Promise(r=>setTimeout(r, wait)); continue } return res }catch(e){ if(i===attempts-1) throw e; await new Promise(r=>setTimeout(r,300*(i+1))) }
  }
}

function buildPayload({ messages, maxTokens, temperature, n }){
  const useMaxCompletion = /gpt[-_ ]?5/i.test(String(MODEL))
  const tokenKey = useMaxCompletion ? 'max_completion_tokens' : 'max_tokens'
  const allowExtra = !useMaxCompletion
  const p = { model: MODEL, messages }
  if(allowExtra && typeof temperature !== 'undefined') p.temperature = temperature
  if(allowExtra && typeof n !== 'undefined') p.n = n
  if(typeof maxTokens !== 'undefined') p[tokenKey] = maxTokens
  return p
}

async function main(){
  const srcPath = path.join(process.cwd(),'tmp','source-for-rephrase.txt')
  if(!fs.existsSync(srcPath)){ console.error('Source file not found:', srcPath); process.exit(2) }
  const src = fs.readFileSync(srcPath,'utf8')
  const short = src.trim().slice(0,1200)
  const system = `You are a careful editorial assistant. Preserve named entities and numeric facts exactly. Produce publication-ready HTML with an <h2> title, a short <p> excerpt and article body.`
  const user = `Rewrite the following content into an original, publication-ready HTML article. Preserve named entities and numeric facts exactly. Content:\n${short}`
  const payload = buildPayload({ messages: [{ role: 'system', content: system }, { role: 'user', content: user }], maxTokens: Number(argv.maxTokens||1600), temperature: Number(argv.temperature||0.2), n: argv.n ? Number(argv.n) : undefined })
  console.error('[debug-openai-call] sending payload to OpenAI, model=', MODEL)
  const useResponses = /gpt[-_ ]?5/i.test(String(MODEL))
  const outDir = path.join(process.cwd(),'tmp')
  const outPath = path.join(outDir, `openai-response-${Date.now()}.json`)
  try{
    if(useResponses){
      const input = `SYSTEM: ${system}\n\nUSER: ${user}`
      const body = { model: MODEL, input }
      if(typeof argv.maxTokens !== 'undefined') body.max_output_tokens = Number(argv.maxTokens)
      const res = await fetchWithRetry('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(body) })
      const json = await res.json()
      fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8')
      console.log('Wrote raw OpenAI Responses output to', outPath)
      // try to extract textual output if available
      try{
        const txt = (json.output && (json.output[0] && json.output[0].content && json.output[0].content[0] && json.output[0].content[0].text)) || ''
        if(txt && txt.trim()){
          const outHtml = path.join(outDir, `rephrase-${Date.now()}.html`)
          fs.writeFileSync(outHtml, txt, 'utf8')
          console.log('Extracted text written to', outHtml)
        }
      }catch(e){}
    } else {
      const res = await fetchWithRetry('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(payload) })
      const body = await res.text()
      fs.writeFileSync(outPath, body, 'utf8')
      console.log('Wrote raw OpenAI chat response to', outPath)
    }
  }catch(e){ console.error('Failed to read/write OpenAI response', e && e.message) }
}

if(require.main===module) main().catch(e=>{ console.error('Error', e && e.message); process.exit(3) })

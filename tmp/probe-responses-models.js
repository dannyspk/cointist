const fetch = global.fetch || require('node-fetch')
const fs = require('fs')
const path = require('path')

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY
if(!OPENAI_KEY){ console.error('Missing OPENAI_API_KEY'); process.exit(2) }

const models = [
  'gpt-5',
  'gpt-5-2025-08-07',
  'gpt-5o',
  'gpt-5o-mini',
  'gpt-5-mini',
  'gpt-5.1',
  'gpt-4o',
  'gpt-4o-mini'
]

const prompt = `Rewrite the following short text into an original sentence preserving named entities and numbers exactly:\n\nContent:\nBingX launched AI Master on September 11, 2025.`

async function probeModel(model){
  try{
    const body = { model, input: [{ role: 'user', content: prompt }], max_output_tokens: 220 }
    const res = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` }, body: JSON.stringify(body) })
    const json = await res.text().catch(()=>null)
    let parsed = null
    try{ parsed = JSON.parse(json) }catch(e){ }
    // determine if textual output exists in known places
    let hasText = false
    let excerpt = ''
    if(parsed){
      if(typeof parsed.output_text === 'string' && parsed.output_text.trim()){ hasText = true; excerpt = parsed.output_text.slice(0,300) }
      if(!hasText && Array.isArray(parsed.output)){
        for(const o of parsed.output){
          if(o && o.text){ hasText = true; excerpt = (excerpt||'') + ' ' + String(o.text).slice(0,300) }
          if(o && o.content && Array.isArray(o.content)){
            for(const c of o.content){ if(c && typeof c.text === 'string' && c.text.trim()){ hasText = true; excerpt = (excerpt||'') + ' ' + c.text.slice(0,300) } }
          }
        }
      }
      // also check top-level text field
      if(!hasText && parsed.text && parsed.text?.content){ hasText = true; excerpt = String(parsed.text.content).slice(0,300) }
    }
    return { model, ok: !!hasText, excerpt: excerpt || (parsed ? JSON.stringify(parsed).slice(0,300) : String(json).slice(0,300)), rawStatus: res.status }
  }catch(e){ return { model, ok:false, error: String(e) } }
}

;(async()=>{
  const results = []
  for(const m of models){
    console.error('Probing', m)
    const r = await probeModel(m)
    results.push(r)
    // small pause
    await new Promise(r=>setTimeout(r, 600))
  }
  const outPath = path.join(process.cwd(),'tmp','responses-models-result.json')
  fs.writeFileSync(outPath, JSON.stringify({ ranAt: Date.now(), results }, null, 2), 'utf8')
  console.log('Wrote results to', outPath)
})()

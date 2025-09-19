// Debug Supabase query and write result to tmp file for inspection
require('dotenv').config({ path: '.vercel.env' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
;(async()=>{
  const out = { timestamp: new Date().toISOString() }
  try{
    const TMP = path.join(process.cwd(),'tmp')
    if(!fs.existsSync(TMP)) fs.mkdirSync(TMP)
    const files = fs.existsSync(TMP) ? fs.readdirSync(TMP).filter(f=>f.startsWith('pipeline-summary-')&&f.endsWith('.json')) : []
    if(!files.length){ out.error='no pipeline summary'; fs.writeFileSync(path.join(TMP,'check-supabase-result.json'), JSON.stringify(out,null,2)); console.log('Wrote result'); process.exit(0) }
    files.sort((a,b)=>fs.statSync(path.join(TMP,b)).mtimeMs - fs.statSync(path.join(TMP,a)).mtimeMs)
    const latest = path.join(TMP, files[0])
    const data = JSON.parse(fs.readFileSync(latest,'utf8'))
    const ids = (data.items||[]).map(i=>i.id).filter(Boolean)
    out.summary = latest; out.ids = ids
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if(!SUPA_URL || !SUPA_KEY){ out.error='missing env'; fs.writeFileSync(path.join(TMP,'check-supabase-result.json'), JSON.stringify(out,null,2)); console.log('Wrote result'); process.exit(0) }
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const res = await supa.from('Article').select('id,slug,title,published,publishedAt,coverImage,thumbnail').in('id', ids)
    out.raw = { error: res.error, data: res.data }
    fs.writeFileSync(path.join(TMP,'check-supabase-result.json'), JSON.stringify(out,null,2))
    console.log('Wrote result to tmp/check-supabase-result.json')
  }catch(e){ out.exception = (e && e.stack) || String(e); fs.writeFileSync(path.join(process.cwd(),'tmp','check-supabase-result.json'), JSON.stringify(out,null,2)); console.log('Wrote result with exception') }
})()

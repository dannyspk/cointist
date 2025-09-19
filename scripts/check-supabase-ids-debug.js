// Debug Supabase query for pipeline IDs with verbose logging
require('dotenv').config({ path: '.vercel.env' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
;(async()=>{
  try{
    const TMP = path.join(process.cwd(),'tmp')
    const files = fs.existsSync(TMP) ? fs.readdirSync(TMP).filter(f=>f.startsWith('pipeline-summary-')&&f.endsWith('.json')) : []
    if(!files.length){ console.error('No pipeline-summary files found'); process.exit(1) }
    files.sort((a,b)=>fs.statSync(path.join(TMP,b)).mtimeMs - fs.statSync(path.join(TMP,a)).mtimeMs)
    const latest = path.join(TMP, files[0])
    const data = JSON.parse(fs.readFileSync(latest,'utf8'))
    const ids = (data.items||[]).map(i=>i.id).filter(Boolean)
    console.log('Using summary:', latest)
    console.log('IDs to check:', ids)
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    console.log('SUPABASE_URL present?', !!SUPA_URL)
    console.log('SUPABASE_KEY present?', !!SUPA_KEY)
    if(!SUPA_URL || !SUPA_KEY){ console.error('Missing SUPABASE_URL or KEY'); process.exit(1) }
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const q = supa.from('Article').select('id,slug,title,published,publishedAt,coverImage,thumbnail').in('id', ids)
    console.log('Sending query...')
    const res = await q
    console.log('Raw response object keys:', Object.keys(res))
    console.log('Error:', JSON.stringify(res.error, null, 2))
    console.log('Data length:', Array.isArray(res.data) ? res.data.length : typeof res.data)
    console.log('Data:', JSON.stringify(res.data, null, 2))
  }catch(e){ console.error('Failed:', e && e.stack || e) }
})()

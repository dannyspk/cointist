// quick check: read latest pipeline summary IDs and query Supabase for them
require('dotenv').config({ path: '.vercel.env' })
const fs = require('fs')
const path = require('path')
async function main(){
  const TMP = path.join(process.cwd(),'tmp')
  const files = fs.existsSync(TMP) ? fs.readdirSync(TMP).filter(f=>f.startsWith('pipeline-summary-')&&f.endsWith('.json')) : []
  if(!files.length){ console.error('No pipeline-summary files found'); process.exit(1) }
  files.sort((a,b)=>fs.statSync(path.join(TMP,b)).mtimeMs - fs.statSync(path.join(TMP,a)).mtimeMs)
  const latest = path.join(TMP, files[0])
  const data = JSON.parse(fs.readFileSync(latest,'utf8'))
  const ids = (data.items||[]).map(i=>i.id).filter(Boolean)
  console.log('Checking Supabase for IDs from', latest, '->', ids)
  if(!ids.length){ console.error('No ids in summary'); process.exit(1) }
  const { createClient } = require('@supabase/supabase-js')
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if(!SUPA_URL || !SUPA_KEY){ console.error('Missing SUPABASE_URL or KEY in env'); process.exit(1) }
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
  try{
    const { data: rows, error } = await supa.from('Article').select('id,slug,title,published,publishedAt,coverImage,thumbnail').in('id', ids)
    if(error) console.error('Supabase error:', error)
    console.log('Supabase rows:', JSON.stringify(rows, null, 2))
  }catch(e){ console.error('Query failed', e && e.message)
  }
}
main()

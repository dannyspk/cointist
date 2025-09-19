(async function(){
  const { createClient } = require('@supabase/supabase-js')
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  console.log('SUPABASE_URL present?', !!url)
  console.log('SUPABASE_KEY present?', !!key)
  if(!url || !key){
    console.error('Missing SUPABASE_URL or SUPABASE key in environment. Aborting.');
    process.exit(2)
  }
  const supa = createClient(url, key, { auth: { persistSession: false } })
  try{
    const res = await supa.rpc('search_articles_with_count', { q: 'staking', lim: 5, off: 0 })
    console.log('RPC response:')
    console.log(JSON.stringify(res, null, 2))
    if(res && !res.error && res.data){
      console.log('Parsed payload:', typeof res.data === 'string' ? JSON.parse(res.data) : res.data)
    }
  }catch(err){
    console.error('RPC call error:', err && err.message ? err.message : err)
    process.exit(1)
  }
})()

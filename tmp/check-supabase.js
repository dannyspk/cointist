const fs = require('fs');
(async function(){
  try{
    const envPath = 'c:/cointistreact/.env.local';
    if(!fs.existsSync(envPath)){
      console.error('.env.local not found at', envPath); process.exit(2);
    }
    const raw = fs.readFileSync(envPath,'utf8');
    const env = {};
    raw.split(/\r?\n/).forEach(line=>{
      const i = line.indexOf('='); if(i<=0) return; let k=line.slice(0,i).trim(); let v=line.slice(i+1).trim(); v=v.replace(/^\"|\"$/g,''); env[k]=v;
    });
    const SUPA_URL = env.SUPABASE_URL; const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
    console.log('SUPA_URL=',SUPA_URL);
    console.log('KEY_PRESENT=',!!SUPA_KEY);
    if(!SUPA_URL || !SUPA_KEY){ console.error('Missing SUPABASE_URL or KEY in .env.local'); process.exit(3); }
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false }});
    console.log('Attempting supa.from("Article").select(...).limit(1)');
    const res = await supa.from('Article').select('id,slug,title').limit(1);
    console.log('Supabase client response:', JSON.stringify({status: res.status, error: res.error, data: Array.isArray(res.data)?res.data.length:typeof res.data}));
    if (res.error) console.error('res.error full:', res.error);
    else console.log('sample row:', res.data && res.data[0] ? res.data[0] : null);
  }catch(e){ console.error('ERR', e && e.message ? e.message : String(e)); process.exit(5); }
})();

const fs = require('fs');
(async ()=>{
  try{
    const envPath = 'c:/cointistreact/.env.local';
    const raw = fs.readFileSync(envPath,'utf8');
    const env = {};
    raw.split(/\r?\n/).forEach(line=>{const i=line.indexOf('='); if(i<=0) return; let k=line.slice(0,i).trim(); let v=line.slice(i+1).trim(); v=v.replace(/^\"|\"$/g,''); env[k]=v;});
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const bucket = 'images'; const prefix = 'thumbnails';
    console.log('Listing', bucket, 'prefix', prefix);
    const { data, error } = await supa.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) { console.error('ERROR', error); process.exit(2); }
    console.log('Found', (data||[]).length, 'objects');
    (data||[]).slice(0,10).forEach(d=> console.log(d.name, d.updated_at, d.metadata && d.metadata.size));
  }catch(e){ console.error('ERR', e && e.message); process.exit(3); }
})();

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
    const { data, error } = await supa.storage.from(bucket).list(prefix, { limit: 20 });
    if (error) { console.error('ERROR', error); process.exit(2); }
    console.log('Found', (data||[]).length, 'objects');
    for (const d of (data||[])){
      const pubRes = supa.storage.from(bucket).getPublicUrl(d.name);
      const pub = pubRes && pubRes.publicURL ? pubRes.publicURL : null;
      let signed = null;
      let signedRes = null;
      try{
        signedRes = await supa.storage.from(bucket).createSignedUrl(d.name, 60*60);
        signed = signedRes && !signedRes.error ? signedRes.signedURL : null;
      } catch(e){ console.error('createSignedUrl exception for', d.name, e && e.message); }
      console.log(d.name, '\n  publicRes=>', pubRes, '\n  signedRes=>', signedRes, '\n  publicUrl=>', pub, '\n  signedUrl=>', signed);
    }
  }catch(e){ console.error('ERR', e && e.message); process.exit(3); }
})();

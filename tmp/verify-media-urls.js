const fs = require('fs');
(async ()=>{
  try{
    const env = {};
    const raw = fs.readFileSync('c:/cointistreact/.env.local','utf8');
    raw.split(/\r?\n/).forEach(line=>{const i=line.indexOf('='); if(i<=0) return; const k=line.slice(0,i).trim(); let v=line.slice(i+1).trim(); v=v.replace(/^\"|\"$/g,''); env[k]=v;});
    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const bucket = 'images'; const prefix = 'thumbnails';
    const { data, error } = await supa.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) { console.error('list error', error); process.exit(2); }
    const dataArr = data || [];
    const normalizeUrl = (u) => {
      if (!u) return null;
      try {
        u = String(u);
        if (u.startsWith('//')) return 'https:' + u;
        if (/^https?:\/\//i.test(u)) return u;
        if (u.startsWith('/')) {
          try { const base = new URL(env.SUPABASE_URL); return base.origin + u; } catch(e) { return 'https://' + u.replace(/^\/+/, ''); }
        }
        return 'https://' + u;
      } catch (e) { return null; }
    };
    for (const obj of dataArr.slice(0,20)) {
      const cleanedPrefix = prefix ? String(prefix).replace(/^\/+|\/+$/g,'') : '';
      const objectPath = cleanedPrefix ? `${cleanedPrefix}/${obj.name}` : obj.name;
      let publicUrl = null;
      try{
        const pubRes = supa.storage.from(bucket).getPublicUrl(objectPath);
        if (pubRes) publicUrl = (pubRes.data && (pubRes.data.publicUrl || pubRes.data.publicURL)) || pubRes.publicURL || pubRes.publicUrl || null;
      }catch(e){ publicUrl = null }
      let finalUrl = normalizeUrl(publicUrl);
      if (!finalUrl && env.SUPABASE_SERVICE_ROLE_KEY && typeof supa.storage.from(bucket).createSignedUrl === 'function'){
        try{
          const signed = await supa.storage.from(bucket).createSignedUrl(objectPath, 60*60);
          if (signed) finalUrl = signed.signedURL || (signed.data && (signed.data.signedUrl || signed.data.signedURL)) || finalUrl;
        }catch(e){}
      }
      console.log('obj:', obj.name);
      console.log(' objectPath:', objectPath);
      console.log(' publicUrl raw:', publicUrl);
      console.log(' finalUrl:', finalUrl);
      console.log('---');
    }
  }catch(e){ console.error('ERR', e && e.message); process.exit(3); }
})();

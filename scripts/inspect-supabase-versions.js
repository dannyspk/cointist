const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }
(async ()=>{
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  const candidates = ['ArticleVersion','articleVersion','article_version','articleversion','article_version'];
  let versions = null; let used = null;
  for (const t of candidates) {
    const { data, error } = await supa.from(t).select('*').limit(10);
    if (!error && data) { versions = data; used = t; break; }
  }
  console.log('Supabase table used:', used);
  console.log('Versions sample count:', versions ? versions.length : 0);
  if (versions && versions.length) {
    for (let i=0;i<versions.length;i++){
      const v = versions[i];
      console.log('--- version',i,'keys:',Object.keys(v));
      for (const k of Object.keys(v)){
        const val = v[k];
        const t = Object.prototype.toString.call(val);
        if (val && typeof val === 'object') {
          const s = JSON.stringify(val).slice(0,200);
          console.log('   ',k, 'type=object sample=', s);
        } else {
          console.log('   ',k, 'type=', typeof val, 'val=', String(val).slice(0,200));
        }
      }
    }
  }
  // local sqlite pragma
  const db = new Database(path.join(process.cwd(),'prisma','dev.db'),{readonly:true});
  const info = db.prepare('PRAGMA table_info(articleVersion)').all();
  console.log('Local articleVersion schema:', info.map(r=>({cid:r.cid,name:r.name,type:r.type}))); 
  db.close();
})();

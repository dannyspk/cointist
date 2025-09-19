const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(process.cwd(),'prisma','dev.db'));
const supa = require('@supabase/supabase-js').createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async ()=>{
  const { data: articles } = await supa.from('Article').select('*');
  const info = db.prepare("PRAGMA table_info(article)").all();
  const cols = info.map(r=>r.name);
  const placeholders = cols.map(()=>'?').join(',');
  const sql = `INSERT OR REPLACE INTO article(${cols.join(',')}) VALUES (${placeholders})`;
  console.log('SQL:', sql);
  const stmt = db.prepare(sql);
  const a = articles[0];
  function coerce(val){
    if (val===undefined) return null;
    if (val===null) return null;
    if (typeof val==='string'||typeof val==='number'||typeof val==='bigint'||Buffer.isBuffer(val)) return val;
    if (typeof val==='boolean') return val?1:0;
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)|| (val && typeof val === 'object')) return JSON.stringify(val);
    return String(val);
  }
  const row = cols.map(c=>{
    if (a.hasOwnProperty(c)) return coerce(a[c]);
    const camel = c.replace(/_([a-z])/g, g=>g[1].toUpperCase());
    if (a.hasOwnProperty(camel)) return coerce(a[camel]);
    if (/date|at/i.test(c) && (a[c]||a[camel])) return coerce(a[c]||a[camel]);
    const v = a[c]||a[camel]||null;
    return coerce(v);
  });
  console.log('cols length', cols.length, 'row length', row.length);
  row.forEach((p,i)=>{ console.log(i, typeof p, (p && p.length)?('len='+p.length):''); });
  try{ stmt.run(...row); console.log('inserted'); } catch(e){ console.error('error', e.message); }
  db.close();
})();

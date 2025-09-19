const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20250902234534_add_pageview_models', 'migration.sql');
const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
console.log('Applying SQL from', sqlPath, 'to', dbPath);
const content = fs.readFileSync(sqlPath,'utf8');
// remove lines starting with -- and trim
const cleaned = content.split('\n').filter(l=>!l.trim().startsWith('--')).join('\n');
const statements = cleaned.split(/;\s*\n/).map(s=>s.trim()).filter(Boolean);
const db = new Database(dbPath);
try{
  db.exec('BEGIN');
  for(const st of statements){
    console.log('exec:', st.substring(0,80).replace(/\n/g,' '),'...');
    db.exec(st + ';');
  }
  db.exec('COMMIT');
  console.log('Applied migration SQL successfully');
}catch(err){
  console.error('apply error', err.message);
  db.exec('ROLLBACK');
}finally{db.close();}

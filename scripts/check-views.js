const Database = require('better-sqlite3');
const path = require('path');
try {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  const db = new Database(dbPath, { readonly: true });
  const pv = db.prepare('SELECT COUNT(*) as c FROM PageView').get();
  const pvd = db.prepare('SELECT COUNT(*) as c FROM PageViewDaily').get();
  console.log('PageView rows:', pv ? pv.c : 0);
  console.log('PageViewDaily rows:', pvd ? pvd.c : 0);
  db.close();
} catch (e) {
  console.error('check failed', e.message || e);
  process.exit(1);
}

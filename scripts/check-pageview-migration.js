const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db', { readonly: true });
try {
  const m = db.prepare("SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '20250902234534_%'").get();
  console.log('migration row:', m);
  const t = db.prepare("SELECT name, sql FROM sqlite_master WHERE name='PageView' OR name='PageViewDaily'").all();
  console.log('table rows count:', t.length);
  t.forEach(r => console.log('table:', r.name, '\n', r.sql.substring(0, 300)));
} catch (err) {
  console.error('err', err.message);
} finally { db.close(); }

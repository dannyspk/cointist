const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log('Checking DB path:', dbPath);
try {
  const db = new Database(dbPath, { readonly: true });
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('tables:', rows.map(r => r.name));
  db.close();
} catch (err) {
  console.error('error reading DB:', err.message);
  process.exit(2);
}

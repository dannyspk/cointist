const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath, { readonly: true });
try {
  const rows = db.prepare("SELECT id, migration_name, applied_steps_count, finished_at FROM _prisma_migrations ORDER BY finished_at DESC").all();
  console.log('migrations:', rows);
} catch (err) {
  console.error('error querying migrations:', err.message);
}
finally { db.close(); }

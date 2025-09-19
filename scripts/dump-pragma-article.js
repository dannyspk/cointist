const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db', { readonly: true });
const info = db.prepare("PRAGMA table_info(article)").all();
console.log(JSON.stringify(info, null, 2));
db.close();

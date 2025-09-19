const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db', { readonly: true });
const info = db.prepare("PRAGMA table_info(article)").all();
const cols = info.map(r => r.name);
console.log('cols JSON:', JSON.stringify(cols));
cols.forEach((c, idx) => {
  const codes = Array.from(c).map(ch => ch.charCodeAt(0));
  console.log(idx, 'name:', JSON.stringify(c), 'codes:', codes);
});
db.close();

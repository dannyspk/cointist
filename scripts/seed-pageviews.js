const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');
const now = new Date();
const dayStr = now.toISOString().slice(0,10);
console.log('Seeding 10 PageView rows for day', dayStr);
const stmt = db.prepare('INSERT INTO PageView (articleId, slug, path, referrer, ipHash, uaHash, sessionId, isBot, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime(?))');
for(let i=0;i<10;i++){
  stmt.run(1, 'test-slug', '/test', 'https://ref', 'h1', 'ua1', 's'+i, 0, now.toISOString());
}
console.log('done');
db.close();

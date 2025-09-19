const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');
const dayStart = new Date(); dayStart.setHours(0,0,0,0);
const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate()+1);
console.log('Aggregating direct SQL for', dayStart.toISOString().slice(0,10));
const q = `SELECT COALESCE(articleId,0) as articleId, slug, COUNT(*) as views, COUNT(DISTINCT sessionId) as uniques FROM PageView WHERE createdAt >= '${dayStart.toISOString()}' AND createdAt < '${dayEnd.toISOString()}' GROUP BY articleId, slug`;
const rows = db.prepare(q).all();
console.log('rows', rows);
const insert = db.prepare('INSERT INTO PageViewDaily (articleId, slug, day, views, uniques) VALUES (?, ?, datetime(?), ?, ?)');
for(const r of rows){
  insert.run(r.articleId === 0 ? null : r.articleId, r.slug, dayStart.toISOString(), r.views, r.uniques);
}
console.log('inserted', rows.length);
db.close();

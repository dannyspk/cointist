const fs = require('fs');
const path = require('path');

async function resolveLastModForUrl(sitePath){
  // sitePath is a path like '/guides/my-slug' or '/'
  // Prefer DB timestamps when available; fallback to file mtime
  // Normalize slug
  const slug = sitePath === '/' ? 'index' : sitePath.replace(/^\//, '').replace(/\/$/, '');

  // Try DB
  try{
    let db = null;
    try {
      db = require('../src/lib/db');
      db = db && (db.default || db);
    } catch (e) {
      db = null;
    }
    if (db && typeof db.findArticleBySlug === 'function'){
      const rec = await db.findArticleBySlug(slug).catch(()=>null);
      if (rec && (rec.updatedAt || rec.publishedAt)){
        const d = rec.updatedAt || rec.publishedAt;
        return (new Date(d)).toISOString().slice(0,10);
      }
    }
    // if DB has a bulk finder, try that (used in generator)
    if (db && typeof db.findArticles === 'function'){
      const items = await db.findArticles({ take: 1000 }).catch(()=>[]);
      if (Array.isArray(items)){
        const match = items.find(i=>i && (i.slug === slug || (`${i.category||''}/${i.slug}`) === slug));
        if (match && (match.updatedAt || match.publishedAt)) return (new Date(match.updatedAt || match.publishedAt)).toISOString().slice(0,10);
      }
    }
  }catch(e){ /* ignore DB failures */ }

  // Fallback: try file mtime in pages
  try{
    const candidateJs = path.join(process.cwd(),'pages', slug + '.js');
    const candidateIndex = path.join(process.cwd(),'pages', slug, 'index.js');
    let stat = null;
    if (fs.existsSync(candidateJs)) stat = fs.statSync(candidateJs);
    else if (fs.existsSync(candidateIndex)) stat = fs.statSync(candidateIndex);
    if (stat) return stat.mtime.toISOString().slice(0,10);
  }catch(e){}

  return null;
}

module.exports = { resolveLastModForUrl };

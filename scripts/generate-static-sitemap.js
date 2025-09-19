const fs = require('fs');
const path = require('path');
const { resolveLastModForUrl } = require('../lib/sitemap-utils');

async function getStaticUrls(){
  const urls = [ '/', '/guides', '/analysis' ];
  const learningPaths = ['/learning-path/beginner','/learning-path/intermediate','/learning-path/advanced'];
  learningPaths.forEach(p=>{ if(!urls.includes(p)) urls.push(p); });

  // Best-effort: include static files under pages/guides and pages/articles
  try{
    const guidesDir = path.join(process.cwd(), 'pages', 'guides');
    if(fs.existsSync(guidesDir)){
      const files = fs.readdirSync(guidesDir).filter(f=>f.endsWith('.js')||f.endsWith('.jsx')||f.endsWith('.ts')||f.endsWith('.tsx'));
      files.forEach(f=>{
        if (f.startsWith('[')) return;
        const slug = f.replace(/\.jsx?$|\.tsx?$|\.ts$|\.js$/,'');
        if(slug !== 'index') urls.push(`/guides/${slug}`);
      });
    }
    const articlesDir = path.join(process.cwd(), 'pages', 'articles');
    if(fs.existsSync(articlesDir)){
      const files = fs.readdirSync(articlesDir).filter(f=>f.endsWith('.js')||f.endsWith('.jsx'));
      files.forEach(f=>{ if (f.startsWith('[')) return; const slug = f.replace(/\.jsx?$/,''); if(slug!=='index') urls.push(`/articles/${slug}`); });
    }
  }catch(e){ /* best-effort */ }

  // Try DB-driven slugs when available
  try{
    let db = null;
    try {
      db = require('../src/lib/db');
      db = db && (db.default || db);
    } catch (e) { db = null; }
    if (db && typeof db.findArticles === 'function'){
      const items = await db.findArticles({ take: 1000, includeGuides: true }).catch(()=>[]);
      if (Array.isArray(items) && items.length){
        items.forEach(it=>{ if (it && it.slug) {
          const u = String(it.category || '').toLowerCase() === 'guides' ? `/guides/${it.slug}` : (`/${String(it.category || 'articles').toLowerCase()}/articles/${it.slug}`);
          if (!urls.includes(u)) urls.push(u);
        }});
      }
    }
  }catch(e){ /* ignore DB failures; sitemap remains best-effort */ }

  // Deduplicate and return
  return Array.from(new Set(urls));
}

async function build(opts){
  opts = opts || {}
  const siteUrl = process.env.SITE_URL || 'https://cointist.net';
  const urls = await getStaticUrls();
  const entries = await Promise.all(urls.map(async (u)=>{
    const entry = { loc: `${siteUrl}${u}` };
    try{
      const lm = await resolveLastModForUrl(u);
      if (lm) entry.lastmod = lm;
    }catch(e){}
    return entry;
  }));
  // Sitemap-clean: deduplicate article entries by slug and prefer category-based URLs (e.g., /news/articles/<slug> or /guides/<slug>).
  const byKey = new Map();
  for (const e of entries) {
    try {
      const urlObj = new URL(e.loc);
      const p = urlObj.pathname.replace(/\/+/g,'/');
      const parts = p.split('/').filter(Boolean);
      const slugKey = parts.length ? parts[parts.length-1] : p;
      const existing = byKey.get(slugKey);
      if (!existing) { byKey.set(slugKey, e); continue; }
      const preferThis = (/\/(news|guides)\//i.test(p));
      const preferExisting = (/\/(news|guides)\//i.test((existing.loc||'').toLowerCase()));
      if (preferThis && !preferExisting) byKey.set(slugKey, e);
    } catch (ex) {
      byKey.set(e.loc, e);
    }
  }

  const filtered = Array.from(byKey.values()).filter(e=>{
    try{ const p = new URL(e.loc).pathname.toLowerCase(); if(p === '/news' || p === '/reviews') return false; }catch(ex){}
    return true;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filtered.map(e=>`  <url><loc>${e.loc}</loc>${e.lastmod?`<lastmod>${e.lastmod}</lastmod>`:''}</url>`).join('\n')}\n</urlset>`;

  const publicDir = path.join(process.cwd(),'public');
  if(!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const tmp = path.join(publicDir, `sitemap.xml.tmp-${Date.now()}`);
  const dest = path.join(publicDir, 'sitemap.xml');
  fs.writeFileSync(tmp, xml, { encoding: 'utf8' });
  fs.renameSync(tmp, dest);
  if (!opts.quiet) console.log('Wrote static sitemap:', dest, 'entries=', filtered.length);
  return { dest, entries: filtered.length };
}
// Expose as module and CLI
module.exports = build;

if (require.main === module) {
  build().catch(e=>{ console.error('Failed to generate static sitemap:', e); process.exit(2); });
}

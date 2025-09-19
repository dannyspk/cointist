import fs from 'fs';
import path from 'path';
import { resolveLastModForUrl } from '../lib/sitemap-utils';

async function getStaticUrls(){
  // Exclude legacy index-like endpoints that don't serve content (e.g. /news, /reviews)
  const urls = [ '/', '/guides', '/analysis' ];
  // always include pretty learning-path URLs (avoid query-string variants)
  const learningPaths = ['/learning-path/beginner','/learning-path/intermediate','/learning-path/advanced'];
  learningPaths.forEach(p=>{ if(!urls.includes(p)) urls.push(p); });
  // Best-effort: include static files under pages/guides and pages/articles
  try{
    const guidesDir = path.join(process.cwd(), 'pages', 'guides');
    if(fs.existsSync(guidesDir)){
      const files = fs.readdirSync(guidesDir).filter(f=>f.endsWith('.js')||f.endsWith('.jsx')||f.endsWith('.ts')||f.endsWith('.tsx'));
      files.forEach(f=>{
        // skip dynamic route placeholders like [slug].js
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

  // If a DB client is available, try to enumerate published article/guide slugs and include them.
  try{
    // use static require guarded by try/catch so bundlers don't treat this as a dynamic dependency
    let db = null;
    try { db = require('../src/lib/db'); db = db && (db.default || db); } catch(e) { db = null; }
    if (db && typeof db.findArticles === 'function'){
      const items = await db.findArticles({ take: 1000, includeGuides: true }).catch(()=>[]);
      if (Array.isArray(items) && items.length){
        items.forEach(it=>{ if (it && it.slug) {
          // avoid duplicates
          const u = String(it.category || '').toLowerCase() === 'guides' ? `/guides/${it.slug}` : (`/${String(it.category || 'articles').toLowerCase()}/articles/${it.slug}`);
          if (!urls.includes(u)) urls.push(u);
        }});
      }
    }
  }catch(e){ /* ignore DB failures; sitemap remains best-effort */ }

  return urls;
}

export async function getServerSideProps({ res }){
  const siteUrl = process.env.SITE_URL || 'https://cointist.net';
  // Build sitemap entries with best-effort lastmod dates
  const urls = await getStaticUrls();
  const entries = await Promise.all(urls.map(async (u)=>{
    const entry = { loc: `${siteUrl}${u}` };
    try{
      const lm = await resolveLastModForUrl(u);
      if (lm) entry.lastmod = lm;
    }catch(e){}
    return entry;
  }));

  // Defensive: remove known-bad paths from entries before emitting sitemap
  // Sitemap-clean: prefer category-based URL when duplicates exist.
  // Build a map by slug key and prefer URLs that include a category segment (e.g., /news/articles/<slug> or /guides/<slug>). If only legacy /articles/<slug> exists, keep it.
  const byKey = new Map();
  for (const e of entries) {
    try {
      const urlObj = new URL(e.loc);
      const p = urlObj.pathname.replace(/\/+/g,'/');
      const parts = p.split('/').filter(Boolean);
      // slugKey: last path segment for article-like entries
      const slugKey = parts.length ? parts[parts.length-1] : p;
      const existing = byKey.get(slugKey);
      if (!existing) { byKey.set(slugKey, e); continue; }
      // Prefer entries that include a category segment (e.g., 'news' or 'guides') or deeper path like /news/articles/<slug>
      const preferThis = (/\/(news|guides)\//i.test(p));
      const preferExisting = (/\/(news|guides)\//i.test((existing.loc||'').toLowerCase()));
      if (preferThis && !preferExisting) byKey.set(slugKey, e);
      // if both or neither preferred, keep the earlier existing (stable)
    } catch (ex) {
      // fallback: include as-is keyed by full loc
      byKey.set(e.loc, e);
    }
  }

  const filtered = Array.from(byKey.values()).filter(e => {
    try {
      const p = new URL(e.loc).pathname.toLowerCase();
      if (p === '/news' || p === '/reviews') return false;
    } catch (ex) { /* ignore */ }
    return true;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${filtered.map(e=>`  <url><loc>${e.loc}</loc>${e.lastmod?`<lastmod>${e.lastmod}</lastmod>`:''}</url>`).join('\n')}\n</urlset>`;
  // Encourage frequent fetches by keeping sitemap cache short
  res.setHeader('Content-Type','application/xml');
  res.setHeader('Cache-Control','no-cache, max-age=60');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function Sitemap(){ return null; }

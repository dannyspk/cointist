const fs = require('fs');
const path = require('path');
// tiny CSV parser (handles quoted fields and commas) to avoid external deps
function parseCsvSync(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim() !== '');
  if (lines.length === 0) return [];
  const headers = [];
  // parse header
  const hdrRow = lines[0];
  let i = 0, cur = '', inQ = false;
  function pushCell(arr){ arr.push(cur); cur = ''; }
  const hdrs = [];
  for (i = 0; i < hdrRow.length; i++){
    const ch = hdrRow[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { hdrs.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.length) hdrs.push(cur);
  const out = [];
  for (let r = 1; r < lines.length; r++){
    const row = lines[r];
    const cols = [];
    cur = ''; inQ = false;
    for (i = 0; i < row.length; i++){
      const ch = row[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur);
    const obj = {};
    for (let c = 0; c < hdrs.length; c++) obj[hdrs[c]] = cols[c] === undefined ? '' : cols[c];
    out.push(obj);
  }
  return out;
}
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function parseBool(v){ if (v === undefined || v === null || v === '') return false; return String(v).toLowerCase() === 'true' || String(v) === '1'; }
function parseJsonField(v){ if (!v) return null; try { return JSON.parse(v); } catch(e){
    // attempt to clean up common CSV quoting around JSON arrays like '['"tag"']'
    try {
      const cleaned = v.replace(/""/g,'"');
      return JSON.parse(cleaned);
    } catch(e2){ return null }
  }}

(async ()=>{
  try{
    const csvPath = path.resolve(process.cwd(), 'public', 'Article_rows.csv');
    if (!fs.existsSync(csvPath)) { console.error('CSV not found at', csvPath); process.exit(2); }
    const raw = fs.readFileSync(csvPath, 'utf8');
  const records = parseCsvSync(raw);
    console.log('Parsed', records.length, 'rows');
    let created = 0, updated = 0, skipped = 0;
    for (const r of records){
      const slug = r.slug && String(r.slug).trim();
      if (!slug){ skipped++; continue; }
      const data = {
        title: r.title || '',
        category: r.category || 'News',
        author: r.author || null,
        coverImage: r.coverImage || null,
        thumbnail: r.thumbnail || null,
        subcategory: r.subcategory || null,
        tags: parseJsonField(r.tags) || null,
        ogTitle: r.ogTitle || null,
        ogDescription: r.ogDescription || null,
        ogImage: r.ogImage || null,
        excerpt: r.excerpt || null,
        content: r.content || null,
        published: parseBool(r.published),
        publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
        scheduledAt: r.scheduledAt ? new Date(r.scheduledAt) : null,
        coverAlt: r.coverAlt || null,
        thumbnailAlt: r.thumbnailAlt || null,
        pinned: parseBool(r.pinned),
        pinnedAt: r.pinnedAt ? new Date(r.pinnedAt) : null,
        // keep featuredOnly default false unless CSV provides it
        featuredOnly: parseBool(r.featuredOnly || r.featuredonly || '')
      };

      // upsert by slug
      const existing = await prisma.article.findUnique({ where: { slug } });
      if (existing) {
        await prisma.article.update({ where: { slug }, data });
        updated++;
      } else {
        // If CSV contains id, don't set it (autoincrement). Just create with slug.
        await prisma.article.create({ data: { slug, ...data } });
        created++;
      }
    }
    console.log('Created', created, 'Updated', updated, 'Skipped', skipped);
    await prisma.$disconnect();
  }catch(e){
    console.error('Error:', e);
    try{ await prisma.$disconnect(); }catch(_){}
    process.exit(1);
  }
})();

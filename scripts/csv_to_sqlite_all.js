const fs = require('fs');
const path = require('path');

// tiny CSV parser (handles quoted fields and commas)
function parseCsvSync(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const hdrRow = lines[0];
  let cur = '', inQ = false;
  const hdrs = [];
  for (let i = 0; i < hdrRow.length; i++){
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
    for (let i = 0; i < row.length; i++){
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

function parseBool(v){ if (v === undefined || v === null || v === '') return false; return String(v).toLowerCase() === 'true' || String(v) === '1'; }
function parseJsonField(v){ if (!v) return null; try { return JSON.parse(v); } catch(e){ try { const cleaned = v.replace(/""/g,'"'); return JSON.parse(cleaned); } catch(e2){ return null } } }

function slugify(s){ if (!s) return ''; return String(s).toLowerCase().replace(/<[^>]*>/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,200) || ''; }

(async ()=>{
  try{
    const csvPath = path.resolve(process.cwd(), 'public', 'Article_rows.csv');
    if (!fs.existsSync(csvPath)) { console.error('CSV not found at', csvPath); process.exit(2); }
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = parseCsvSync(raw);
    console.log('Parsed', records.length, 'rows');

    const prismaSrc = path.resolve(process.cwd(), 'prisma', 'dev.db');
    const prismaDst = path.resolve(process.cwd(), 'prisma', 'dev_all.db');
    if (!fs.existsSync(prismaSrc)) {
      console.warn('Source prisma dev.db not found at', prismaSrc, '- proceeding to create a new sqlite file from scratch');
    }
    // ensure target exists by copying source when available
    if (!fs.existsSync(prismaDst) && fs.existsSync(prismaSrc)) {
      fs.copyFileSync(prismaSrc, prismaDst);
      console.log('Copied', prismaSrc, '->', prismaDst);
    } else if (!fs.existsSync(prismaDst)) {
      // create empty sqlite file
      fs.writeFileSync(prismaDst, '');
      console.log('Created empty', prismaDst);
    } else {
      console.log('Target DB already exists at', prismaDst, '- it will be cleared and re-populated.');
    }

    // Ensure Prisma uses the new DB file for this run
    process.env.DATABASE_URL = 'file:./prisma/dev_all.db';
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Clear existing data to produce a fresh DB with only CSV rows
    try{ await prisma.articleVersion.deleteMany(); }catch(e){}
    try{ await prisma.article.deleteMany(); }catch(e){}
    console.log('Cleared Article and ArticleVersion tables in dev_all.db');

    let created = 0;
    const seenSlugs = new Set();

    for (const r of records){
      let slug = (r.slug && String(r.slug).trim()) || '';
      if (!slug) {
        slug = slugify(r.title) || slugify(r.excerpt) || 'article';
      } else {
        slug = slugify(slug) || slug;
      }
      let base = slug || 'article';
      let attempt = 0;
      // ensure uniqueness within this import by appending numeric suffixes deterministically
      while (seenSlugs.has(slug)) {
        attempt++;
        slug = `${base}-${attempt}`;
        if (attempt > 1000) throw new Error('Unable to generate unique slug for row: ' + JSON.stringify(r).slice(0,200));
      }
      seenSlugs.add(slug);

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
        featuredOnly: parseBool(r.featuredOnly || r.featuredonly || '')
      };

      // attempt create, retrying with suffix if unique constraint still occurs
      let saved = false;
      let localAttempt = 0;
      while (!saved) {
        try {
          await prisma.article.create({ data: { slug, ...data } });
          saved = true;
          created++;
        } catch (err) {
          // if unique constraint on slug, append suffix and retry
          const msg = err && err.message ? String(err.message).toLowerCase() : '';
          if (msg.includes('unique') && localAttempt < 1000) {
            localAttempt++;
            slug = `${base}-${attempt || 0}-${localAttempt}`;
            continue;
          }
          throw err;
        }
      }
    }

    console.log('Created', created, 'rows in prisma/dev_all.db');
    await prisma.$disconnect();
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

function slugify(s){ if (!s) return '';
  return String(s).toLowerCase()
    .replace(/<[^>]*>/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,200) || '';
}

(async ()=>{
  try{
    const csvPath = path.resolve(process.cwd(), 'public', 'Article_rows.csv');
    if (!fs.existsSync(csvPath)) { console.error('CSV not found at', csvPath); process.exit(2); }
    const raw = fs.readFileSync(csvPath, 'utf8');
    const records = parseCsvSync(raw);
    console.log('Parsed', records.length, 'rows');

    const prismaSrc = path.resolve(process.cwd(), 'prisma', 'dev.db');
    const prismaDst = path.resolve(process.cwd(), 'prisma', 'dev_all.db');
    if (!fs.existsSync(prismaSrc)) { console.error('Source prisma dev.db not found at', prismaSrc); process.exit(2); }
    if (!fs.existsSync(prismaDst)) {
      fs.copyFileSync(prismaSrc, prismaDst);
      console.log('Copied', prismaSrc, '->', prismaDst);
    } else {
      console.log('Target DB already exists at', prismaDst, '- it will be cleared and re-populated.');
    }

    // Force Prisma to use the new DB file at runtime
    process.env.DATABASE_URL = 'file:./prisma/dev_all.db';
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Clear existing data to produce a fresh DB with only CSV rows
    await prisma.articleVersion.deleteMany();
    await prisma.article.deleteMany();
    console.log('Cleared Article and ArticleVersion tables in dev_all.db');

    let created = 0, updated = 0;
    const seenSlugs = new Set();

    for (const r of records){
      // generate or clean slug
      let slug = (r.slug && String(r.slug).trim()) || '';
      if (!slug) {
        slug = slugify(r.title) || slugify(r.excerpt) || 'article';
      } else {
        slug = slugify(slug) || slug;
      }
      // ensure uniqueness within this import by appending suffixes if necessary
      let base = slug || 'article';
      let attempt = 0;
      while (seenSlugs.has(slug) || await prisma.article.findUnique({ where: { slug } })){
        attempt++;
        slug = base + '-' + attempt;
        if (attempt > 1000) throw new Error('Unable to generate unique slug for row: ' + JSON.stringify(r).slice(0,200));
      }
      seenSlugs.add(slug);

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
        featuredOnly: parseBool(r.featuredOnly || r.featuredonly || '')
      };

      // always create new rows (we cleared the table) — keep id autoincrement
      await prisma.article.create({ data: { slug, ...data } });
      created++;
    }

    console.log('Created', created, 'rows in prisma/dev_all.db');
    await prisma.$disconnect();
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

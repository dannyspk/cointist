#!/usr/bin/env node
/*
 Read tmp/selection-from-pipeline.json, query Supabase for authoritative Article rows (id,slug,title,excerpt),
 update the selection file (backup first) and also write tmp/selected.json with canonical items.

 Usage:
  node scripts/update-selection-with-db.js
  node scripts/update-selection-with-db.js --in tmp/selection-from-pipeline.json --out tmp/selection-from-pipeline.json
  node scripts/update-selection-with-db.js --out tmp/selected.json
*/

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const cwd = process.cwd();
const inPath = path.resolve(argv.in || path.join(cwd, 'tmp', 'selection-from-pipeline.json'));
const outPath = path.resolve(argv.out || inPath);
const selectedOut = path.resolve(path.join(cwd, 'tmp', 'selected.json'));

if (!fs.existsSync(inPath)) {
  console.error('Input selection file not found:', inPath);
  process.exit(1);
}

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}
let createClient;
try { createClient = require('@supabase/supabase-js').createClient; } catch (e) {
  console.error('Please install @supabase/supabase-js to run this script.');
  process.exit(1);
}
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

async function fetchArticleBySlugOrId({ id, slug }) {
  try {
    if (id) {
      const res = await supa.from('Article').select('id,slug,title,excerpt,oldslug').eq('id', id).limit(1).maybeSingle();
      if (res && res.data) return res.data;
    }
    if (slug) {
      const res = await supa.from('Article').select('id,slug,title,excerpt,oldslug').eq('slug', slug).limit(1).maybeSingle();
      if (res && res.data) return res.data;
    }
  } catch (e) {
    console.error('Supabase query error for', { id, slug }, e && e.message ? e.message : e);
  }
  return null;
}

function slugifyTitle(s) {
  if (!s) return null;
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0,120);
}

(async function main(){
  try {
    const raw = fs.readFileSync(inPath, 'utf8');
    const j = JSON.parse(raw);
    const selected = Array.isArray(j.selected) ? j.selected : (Array.isArray(j.items) ? j.items : []);
    if (!selected.length) {
      console.error('No selected items found in', inPath);
      process.exit(2);
    }

    // backup
    const bak = inPath + '.' + Date.now() + '.bak';
    fs.copyFileSync(inPath, bak);
    console.log('Backup created at', bak);

    const outSelected = [];
    for (const it of selected) {
      const id = (typeof it.id !== 'undefined' && it.id !== null) ? Number(it.id) : null;
      const slug = it.slug || null;
      const fetched = await fetchArticleBySlugOrId({ id, slug });
      if (fetched) {
        const out = { id: fetched.id, slug: fetched.slug || slug || null, title: fetched.title || null, summary: fetched.excerpt || null };
        // prefer DB oldslug if present, else preserve input oldSlug/oldslug, else derive from title
        if (fetched.oldslug) out.oldslug = fetched.oldslug;
        else if (it.oldSlug || it.oldslug) out.oldslug = it.oldSlug || it.oldslug;
        else if (out.title) out.oldslug = slugifyTitle(out.title);
        outSelected.push(out);
      } else {
        // keep original values if DB lookup fails, but ensure oldslug and slug exist
        const out = { id: id || null, slug: slug || null, title: it.title || null, summary: it.summary || it.excerpt || null };
  if (it.oldSlug || it.oldslug) out.oldslug = it.oldSlug || it.oldslug;
  else if (out.title) out.oldslug = slugifyTitle(out.title);
  // ensure slug exists: prefer existing slug, otherwise derive from title
  if (!out.slug && out.title) out.slug = slugifyTitle(out.title);
        outSelected.push(out);
      }
    }

    // write selection file (overwrite)
    const writeObj = { selected: outSelected };
    fs.writeFileSync(outPath, JSON.stringify(writeObj, null, 2), 'utf8');
    console.log('Wrote updated selection to', outPath);

    // also write tmp/selected.json with canonical items
  const canonical = { count: outSelected.length, items: outSelected.map(o => ({ id: o.id, slug: o.slug, title: o.title, excerpt: o.summary, oldslug: o.oldslug || null })), createdAt: new Date().toISOString(), source: inPath };
    fs.writeFileSync(selectedOut, JSON.stringify(canonical, null, 2), 'utf8');
    console.log('Wrote canonical selected to', selectedOut);

    process.exit(0);
  } catch (e) {
    console.error('Error updating selection from DB', e && e.message ? e.message : e);
    process.exit(3);
  }
})();

#!/usr/bin/env node
/*
 Robust resolver for tmp/selection-from-pipeline.json
 Attempts: id -> slug -> exact title -> ilike title (fuzzy)
 Writes backup and updates selection file and tmp/selected.json
 Prints per-item resolution report
*/

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const cwd = process.cwd();
const inPath = path.resolve(argv.in || path.join(cwd, 'tmp', 'selection-from-pipeline.json'));
const outPath = path.resolve(argv.out || inPath);
const selectedOut = path.resolve(path.join(cwd, 'tmp', 'selected.json'));

if (!fs.existsSync(inPath)) { console.error('input not found', inPath); process.exit(1); }

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) { console.error('Missing SUPABASE env vars'); process.exit(1); }
let createClient;
try { createClient = require('@supabase/supabase-js').createClient; } catch (e) { console.error('Install @supabase/supabase-js'); process.exit(1); }
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

async function queryById(id) {
  const r = await supa.from('Article').select('id,slug,title,excerpt').eq('id', id).limit(1).maybeSingle();
  return r && r.data ? r.data : null;
}
async function queryBySlug(slug) {
  const r = await supa.from('Article').select('id,slug,title,excerpt').eq('slug', slug).limit(1).maybeSingle();
  return r && r.data ? r.data : null;
}
async function queryByExactTitle(title) {
  const r = await supa.from('Article').select('id,slug,title,excerpt').eq('title', title).limit(1).maybeSingle();
  return r && r.data ? r.data : null;
}
async function queryByFuzzyTitle(title) {
  // use ilike with surrounding % to find partial matches
  const r = await supa.from('Article').select('id,slug,title,excerpt').ilike('title', `%${title}%`).limit(5);
  return r && r.data && r.data.length ? r.data : null;
}

(async function main(){
  const raw = fs.readFileSync(inPath, 'utf8');
  const j = JSON.parse(raw);
  const items = Array.isArray(j.selected) ? j.selected : (Array.isArray(j.items) ? j.items : []);
  if (!items.length) { console.error('no items'); process.exit(1); }

  const bak = inPath + '.' + Date.now() + '.bak';
  fs.copyFileSync(inPath, bak);
  console.log('Backup created:', bak);

  const out = [];
  for (const it of items) {
    const origId = (typeof it.id !== 'undefined' && it.id !== null) ? Number(it.id) : null;
    const origSlug = it.slug || null;
    const origTitle = it.title || null;
    console.log('\nResolving:', { id: origId, slug: origSlug, title: origTitle });

    let resolved = null;
    if (origId) {
      resolved = await queryById(origId);
      if (resolved) console.log('Resolved by id ->', resolved.id, resolved.slug);
    }
    if (!resolved && origSlug) {
      resolved = await queryBySlug(origSlug);
      if (resolved) console.log('Resolved by slug ->', resolved.id, resolved.slug);
    }
    if (!resolved && origTitle) {
      resolved = await queryByExactTitle(origTitle);
      if (resolved) console.log('Resolved by exact title ->', resolved.id, resolved.slug);
    }
    if (!resolved && origTitle) {
      const fuzzy = await queryByFuzzyTitle(origTitle);
      if (fuzzy && fuzzy.length === 1) {
        resolved = fuzzy[0];
        console.log('Resolved by fuzzy title ->', resolved.id, resolved.slug);
      } else if (fuzzy && fuzzy.length > 1) {
        console.log('Fuzzy title returned multiple candidates, keeping original values');
      } else {
        console.log('Fuzzy title returned no matches');
      }
    }

    if (resolved) {
      out.push({ id: resolved.id, slug: resolved.slug, title: resolved.title || null, summary: resolved.excerpt || null });
    } else {
      out.push({ id: origId || null, slug: origSlug || null, title: origTitle || null, summary: it.summary || it.excerpt || null });
    }
  }

  fs.writeFileSync(outPath, JSON.stringify({ selected: out }, null, 2), 'utf8');
  fs.writeFileSync(selectedOut, JSON.stringify({ count: out.length, items: out.map(o => ({ id: o.id, slug: o.slug, title: o.title, excerpt: o.summary })), createdAt: new Date().toISOString(), source: inPath }, null, 2), 'utf8');
  console.log('\nWrote updated selection to', outPath);
  console.log('Wrote canonical selected to', selectedOut);
  process.exit(0);
})();

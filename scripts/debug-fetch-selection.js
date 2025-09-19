#!/usr/bin/env node
// Debug helper: find the latest selection-from-pipeline.json.*.bak in tmp/, read its items,
// query Supabase for each id/slug and print results to help diagnose duplicate id mapping.

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const TMP = path.join(process.cwd(), 'tmp');

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

function findLatestBackup() {
  if (!fs.existsSync(TMP)) return null;
  const files = fs.readdirSync(TMP).filter(f => f.startsWith('selection-from-pipeline.json.') && f.endsWith('.bak'));
  if (!files.length) return null;
  files.sort();
  return path.join(TMP, files[files.length - 1]);
}

async function fetchArticleBySlugOrId({ id, slug }) {
  try {
    if (id) {
      const res = await supa.from('Article').select('id,slug,title,excerpt').eq('id', id).limit(1).maybeSingle();
      if (res && res.data) return { source: 'id', data: res.data };
    }
    if (slug) {
      const res = await supa.from('Article').select('id,slug,title,excerpt').eq('slug', slug).limit(1).maybeSingle();
      if (res && res.data) return { source: 'slug', data: res.data };
    }
  } catch (e) {
    return { error: e && e.message ? e.message : String(e) };
  }
  return null;
}

(async function main(){
  const bak = argv.file || findLatestBackup();
  if (!bak) {
    console.error('No backup file found in tmp/');
    process.exit(1);
  }
  console.log('Using backup:', bak);
  const raw = fs.readFileSync(bak, 'utf8');
  const j = JSON.parse(raw);
  const items = Array.isArray(j.selected) ? j.selected : (Array.isArray(j.items) ? j.items : []);
  if (!items.length) {
    console.error('No items in', bak);
    process.exit(1);
  }
  for (const it of items) {
    const id = (typeof it.id !== 'undefined' && it.id !== null) ? Number(it.id) : null;
    const slug = it.slug || null;
    console.log('\nOriginal entry: id=', id, 'slug=', slug, 'title=', it.title || '');
    const fetched = await fetchArticleBySlugOrId({ id, slug });
    if (!fetched) {
      console.log('DB: no match for id/slug');
      continue;
    }
    if (fetched.error) {
      console.log('DB error:', fetched.error);
      continue;
    }
    console.log('DB match (via', fetched.source, '): id=', fetched.data.id, 'slug=', fetched.data.slug, 'title=', fetched.data.title);
  }
  process.exit(0);
})();

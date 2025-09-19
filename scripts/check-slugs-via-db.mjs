#!/usr/bin/env node
import path from 'path';
import url from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Read selection JSON via fs to avoid import assertion cross-platform issues
const selPath = path.join(repoRoot, 'tmp', 'selection-from-pipeline.json');
let sel;
try {
  const raw = await fs.readFile(selPath, 'utf8');
  sel = JSON.parse(raw);
} catch (e) {
  console.error('Failed to read selection JSON:', e && e.message ? e.message : e);
  process.exit(1);
}

// Note: src/lib/db.js mixes CommonJS require() and ESM exports and cannot be imported
// directly from an ESM script in this environment. Below we implement direct
// Supabase or Prisma CJS lookups instead to query the authoritative rows.

// New approach: prefer Supabase via env, otherwise use Prisma CJS client
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let useSupabase = false;
let supaClient = null;
if (SUPA_URL && SUPA_KEY) {
  supaClient = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
  useSupabase = true;
}

let prismaClient = null;
if (!useSupabase) {
  try {
    const require = createRequire(import.meta.url);
    prismaClient = require(path.join(repoRoot, 'src', 'lib', 'prisma.cjs'));
  } catch (e) {
    // ignore
  }
}

async function findBySlugViaSupabase(slug) {
  const res = await supaClient.from('Article').select('*').eq('slug', slug).limit(1);
  if (res.error) throw res.error;
  if (res.data && res.data[0]) return res.data[0];
  const r2 = await supaClient.from('Guides').select('*').eq('slug', slug).limit(1);
  if (r2.error) throw r2.error;
  return r2.data && r2.data[0] ? r2.data[0] : null;
}

async function findBySlugViaPrisma(slug) {
  if (!prismaClient) return null;
  return prismaClient.article.findUnique({ where: { slug } });
}

for (const it of (sel.selected || [])) {
  console.log('\n=== Checking slug:', it.slug, '===');
  try {
    let row = null;
    if (useSupabase) row = await findBySlugViaSupabase(it.slug);
    else row = await findBySlugViaPrisma(it.slug);
    console.log(' Authoritative DB row:', row ? { id: row.id, slug: row.slug, title: row.title || null } : null);
  } catch (e) {
    console.error(' Error while checking:', e && e.message ? e.message : e);
  }
}


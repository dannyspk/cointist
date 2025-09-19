#!/usr/bin/env node
/**
 * Batch upsert three Track 3 guide HTML files into Supabase Guides table.
 * Usage: node scripts/upsert-track3-guides-to-supabase.js <path-to-html-folder>
 * Requires .vercel.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.vercel.env' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .vercel.env');
  process.exit(1);
}
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

const folder = process.argv[2] || path.join(process.cwd(), 'tmp', 'track3-html');
const nowIso = (new Date()).toISOString();

function readHtml(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    console.error('Failed to read', filePath, e && e.message);
    return null;
  }
}

function extractTitle(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].trim() : null;
}

function extractDefinitionExcerpt(html) {
  const m = html.match(/<aside[^>]*class=["']?definition["']?[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/aside>/i);
  if (m) return m[1].trim();
  // fallback: first paragraph
  const p = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return p ? p[1].trim() : '';
}

function extractMainArticleHtml(html) {
  const m = html.match(/<article[\s\S]*?>[\s\S]*?<\/article>/i);
  if (m) return m[0];
  // fallback: body inner
  const b = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return b ? b[1].trim() : html;
}

function slugFromFilename(name){
  return path.basename(name, path.extname(name)).replace(/[^a-z0-9\-]+/gi,'-').toLowerCase();
}

async function upsertGuide(guide){
  try{
    // Optionally delete existing Article row with same slug to avoid duplicate tables
    try{
      await supa.from('Article').delete().eq('slug', guide.slug);
    }catch(e){ /* ignore */ }

    const { data, error } = await supa.from('Guides').upsert([guide], { onConflict: 'slug' }).select();
    if (error) {
      console.error('Upsert error for', guide.slug, error.message || error);
      return null;
    }
    console.log('Upserted:', guide.slug, data && data[0] ? data[0].id : '(no id)');
    return data && data[0] ? data[0] : data;
  }catch(e){ console.error('Exception upserting', guide.slug, e && e.message); return null }
}

async function main(){
  const files = [
    path.join(folder, 'nfts-gaming.html'),
    path.join(folder, 'privacy-identity.html'),
    path.join(folder, 'stablecoins-payments.html')
  ];
  const results = [];
  for(const f of files){
    const html = readHtml(f);
    if(!html) continue;
    const title = extractTitle(html) || slugFromFilename(f);
    const excerpt = extractDefinitionExcerpt(html) || '';
    const content = extractMainArticleHtml(html);
    const slug = slugFromFilename(f);

    const guide = {
      slug,
      title,
      category: 'Guides',
      author: 'Cointist Editorial',
      excerpt,
      content,
      published: true,
      publishedAt: nowIso,
      pinned: false,
      coverImage: null,
      thumbnail: null,
      coverAlt: null,
      thumbnailAlt: null
    };

    const up = await upsertGuide(guide);
    results.push(up);
  }
  console.log('Done. Upserted count:', results.filter(Boolean).length);
}

main();

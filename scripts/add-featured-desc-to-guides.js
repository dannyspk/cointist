#!/usr/bin/env node
// Populate `featuredDescription` on all Guides rows in Supabase.
// Dry-run by default. Use --apply --yes to perform updates.
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.');
  process.exit(2);
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const argv = require('minimist')(process.argv.slice(2));
const DO_APPLY = argv.apply || argv._.includes('--apply');
const YES = argv.yes || argv._.includes('--yes');
const mappingPath = argv.mapping || argv.m || null;
let mapping = null;
if (mappingPath) {
  try{ mapping = require(mappingPath); }catch(e){
    try{ mapping = require(path.resolve(mappingPath)); }catch(e2){
      console.error('Failed to load mapping file:', mappingPath, e2 && e2.message ? e2.message : e2);
      process.exit(5);
    }
  }
}
const path = require('path');

function stripHtml(s){ if(!s) return ''; return String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
function snippetFromContent(s, words=28){ if(!s) return ''; const t = stripHtml(s).split(/\s+/).filter(Boolean).slice(0,words).join(' '); return t ? (t + '…') : '' }

async function main(){
  try{
    const { data, error } = await supa.from('Guides').select('*').limit(1000);
    if (error) { console.error('Supabase error:', error); process.exit(3); }
    if (!data || !data.length) { console.log('No guides found.'); return; }

    const planned = [];
    for (const row of data){
      const id = row.id;
      // Prefer explicit featuredDescription fields (camel or snake), then ogDescription, then excerpt, then content snippet
      const existing = row.featuredDescription || row.featured_desc || row.featured_description || row.featured || null;
      if (existing && String(existing).trim()) continue; // skip if already present

      // If mapping provided, prefer mapping value by slug
      let val = null;
      const slug = row.slug || row.slugified || row.id && String(row.id);
      if (mapping && slug && mapping[slug]) {
        val = String(mapping[slug]).trim();
      }
      if (!val) {
        const candidate = row.ogDescription || row.og_description || row.og || row.description || row.lead || row.excerpt || row.excerpt_text || snippetFromContent(row.content);
        val = stripHtml(candidate).trim();
      }
      val = val.slice(0,280); // limit length
      planned.push({ id, slug: row.slug || null, title: row.title || null, current: existing || null, proposed: val });
    }

    if (!planned.length) { console.log('No missing featuredDescription fields found (nothing to do).'); return; }

    console.log('Planned updates (count=' + planned.length + '):');
    for (const p of planned){
      console.log('-', p.id, p.slug, '->', p.proposed ? p.proposed : '[empty]');
    }

    if (!DO_APPLY){
      console.log('\nDry-run (no updates applied). To apply updates re-run with --apply --yes');
      return;
    }

    if (!YES){
      console.error('\nRefusing to apply updates: missing --yes confirmation.');
      process.exit(4);
    }

    console.log('\nApplying updates...');
    for (const p of planned){
      try{
        const upd = { featuredDescription: p.proposed };
        const { data: udata, error: uerr } = await supa.from('Guides').update(upd).eq('id', p.id).select();
        if (uerr) console.error('Update failed for id', p.id, uerr);
        else console.log('Updated id', p.id, 'slug', p.slug);
      }catch(e){ console.error('Unexpected update error for id', p.id, e && e.message ? e.message : e); }
    }

    console.log('Done.');
  }catch(e){ console.error('Unexpected error', e && e.message ? e.message : e); process.exit(99); }
}

main();

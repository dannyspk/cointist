#!/usr/bin/env node
/*
  scripts/update-guides-titles-supabase.js

  Usage:
    node scripts/update-guides-titles-supabase.js --list
    node scripts/update-guides-titles-supabase.js --mapping mapping.json [--apply] [--yes]

  Notes:
    - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY in environment.
    - By default the script runs as a dry-run and prints planned updates. Use --apply --yes to actually perform updates.
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function usage() {
  console.log(`Usage:
  --list                         List Guides (id, slug, title)
  --mapping <file>               Path to JSON mapping file (slug -> newTitle)
  --apply                        Actually run update (without this it's a dry-run)
  --yes                          Confirm apply (required together with --apply)
  --limit <n>                    Limit number of rows when listing (default 1000)
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) return usage();

  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--apply') opts.apply = true;
    else if (a === '--yes') opts.yes = true;
    else if (a === '--mapping') opts.mapping = argv[++i];
    else if (a === '--limit') opts.limit = Number(argv[++i]) || 1000;
    else { console.log('Unknown arg', a); return usage(); }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.');
    process.exit(2);
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  if (opts.list) {
    const limit = opts.limit || 1000;
    console.log(`Listing up to ${limit} Guides...`);
    const { data, error } = await supa.from('Guides').select('id,slug,title').order('id', { ascending: true }).limit(limit);
    if (error) {
      console.error('Supabase error listing Guides:', error);
      process.exit(3);
    }
    if (!data || !data.length) {
      console.log('No guides found.');
      return;
    }
    console.table(data.map(r => ({ id: r.id, slug: r.slug, title: r.title })));
    return;
  }

  if (opts.mapping) {
    const mapPath = path.resolve(process.cwd(), opts.mapping);
    if (!fs.existsSync(mapPath)) { console.error('Mapping file not found at', mapPath); process.exit(4); }
    let mapping;
    try {
      mapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse mapping JSON:', e && e.message);
      process.exit(5);
    }

    // Accept either object {slug: newTitle} or array [{slug, title}]
    let entries = [];
    if (Array.isArray(mapping)) {
      entries = mapping.map(x => ({ slug: x.slug, title: x.title }));
    } else if (mapping && typeof mapping === 'object') {
      entries = Object.keys(mapping).map(slug => ({ slug, title: mapping[slug] }));
    } else {
      console.error('Mapping must be an object (slug->title) or array [{slug,title}]');
      process.exit(6);
    }

    if (!entries.length) { console.log('No mapping entries found; nothing to do.'); return; }

    console.log('Planned updates:');
    entries.forEach(e => console.log(`  ${e.slug} => "${e.title}"`));

    if (!opts.apply) { console.log('\nDry-run (no updates applied). To apply, re-run with --apply --yes'); return; }
    if (!opts.yes) { console.log('\nTo actually apply changes include --yes'); return; }

    // Apply updates sequentially
    for (const e of entries) {
      try {
        const { data, error } = await supa.from('Guides').update({ title: e.title }).eq('slug', e.slug).select();
        if (error) {
          console.error(`Failed to update ${e.slug}:`, error);
        } else if (!data || !data.length) {
          console.warn(`No Guides row matched slug='${e.slug}' (skipped)`);
        } else {
          console.log(`Updated slug='${e.slug}' -> id=${data[0].id}`);
        }
      } catch (err) {
        console.error('Unexpected error updating', e.slug, err && err.message ? err.message : err);
      }
    }

    console.log('Done.');
    return;
  }

  console.log('No action specified. Use --list or --mapping <file> [--apply --yes]');
}

main().catch(e => { console.error('Unhandled error', e && e.stack ? e.stack : e); process.exit(99); });

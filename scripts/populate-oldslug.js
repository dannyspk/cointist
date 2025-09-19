#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

async function main() {
  const p = path.join(process.cwd(), 'tmp', 'selected.json');
  if (!fs.existsSync(p)) {
    console.error('File not found:', p);
    process.exit(2);
  }

  const raw = fs.readFileSync(p, 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('Invalid JSON in', p); process.exit(3); }
  if (!data || !Array.isArray(data.items)) { console.error('No items array in', p); process.exit(4); }

  let changed = false;
  const changes = [];

  for (const it of data.items) {
    if (it.oldslug) continue;
    const id = it.id || null;
    const slug = it.slug || null;
    if (!id && !slug) {
      console.log('Skipping item with no id or slug:', JSON.stringify(it).slice(0,100));
      continue;
    }

    let res = null;
    try {
      if (id) {
        res = await supa.from('Article').select('oldslug').eq('id', id).limit(1).maybeSingle();
      }
      if ((!res || !res.data) && slug) {
        res = await supa.from('Article').select('oldslug').eq('slug', slug).limit(1).maybeSingle();
      }
    } catch (e) {
      console.error('Supabase query error for', { id, slug }, e && e.message ? e.message : e);
      continue;
    }

    if (res && res.data && res.data.oldslug) {
      it.oldslug = res.data.oldslug;
      changed = true;
      changes.push({ id, slug, oldslug: it.oldslug });
      console.log('Populated oldslug for', slug || id, '=>', it.oldslug);
    } else {
      console.log('No oldslug found for', slug || id);
    }
  }

  if (changed) {
    // backup
    try {
      const bak = p + '.bak.' + Date.now();
      fs.writeFileSync(bak, raw, 'utf8');
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
      console.log('Updated', p, ' (backup saved to', bak + ')');
      console.log('Changes:', JSON.stringify(changes, null, 2));
      process.exit(0);
    } catch (e) {
      console.error('Error writing updated file', e && e.message ? e.message : e);
      process.exit(5);
    }
  } else {
    console.log('No updates were necessary.');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(10); });

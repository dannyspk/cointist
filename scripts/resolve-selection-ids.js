#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const root = process.cwd();
  const tmp = path.join(root, 'tmp');
  const selFile = path.join(tmp, 'selection-from-pipeline.json');
  if (!fs.existsSync(selFile)) {
    console.error('selection file not found:', selFile);
    process.exit(2);
  }
  const raw = fs.readFileSync(selFile, 'utf8');
  let doc;
  try { doc = JSON.parse(raw); } catch (e) { console.error('invalid JSON in selection file'); process.exit(3); }
  const items = Array.isArray(doc.selected) ? doc.selected : [];
  if (!items.length) { console.log('no items in selection'); return; }

  // load pipeline-summary files and build slug->id map
  const summaryFiles = fs.readdirSync(tmp).filter(f => f.startsWith('pipeline-summary-') && f.endsWith('.json'));
  const slugMap = {};
  for (const f of summaryFiles) {
    try {
      const p = path.join(tmp, f);
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (j && Array.isArray(j.items)) {
        for (const it of j.items) {
          const s = (it && it.slug) ? String(it.slug).toLowerCase() : null;
          const numeric = (it && (it.id ?? it.articleId ?? it.selectionId ?? it.sourceId ?? it.originalId));
          if (s && numeric != null) {
            if (!slugMap[s]) slugMap[s] = Number(numeric);
          }
        }
      }
    } catch (e) { /* ignore parse errors */ }
  }

  // Optional Supabase lookup if env vars present
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  let useSupabase = false;
  let supa = null;
  if (SUPA_URL && SUPA_KEY) {
    try {
      const { createClient } = require('@supabase/supabase-js');
      supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
      useSupabase = true;
    } catch (e) {
      useSupabase = false;
    }
  }

  const unresolved = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i] || {};
    if (typeof it.id === 'number' && Number.isFinite(it.id)) continue;
    const slug = (it.slug || '').toString().toLowerCase();
    let found = null;
    if (slug && slugMap[slug]) {
      found = slugMap[slug];
      items[i].id = found;
      console.log('resolved from pipeline-summary:', slug, '->', found);
      continue;
    }
    if (useSupabase && slug) {
      try {
        const res = await supa.from('Article').select('id').eq('slug', slug).limit(1);
        if (!res.error && Array.isArray(res.data) && res.data[0] && typeof res.data[0].id === 'number') {
          found = Number(res.data[0].id);
          items[i].id = found;
          console.log('resolved from Supabase:', slug, '->', found);
          continue;
        }
      } catch (e) { /* ignore supabase errors */ }
    }
    unresolved.push({ index: i, slug: it.slug || null, title: it.title || null });
  }

  if (unresolved.length) {
    console.warn('Some items remain unresolved (no numeric DB id):', JSON.stringify(unresolved, null, 2));
  }

  // Only write the file if at least one id was filled and none remain unresolved
  const allHaveId = items.every(it => typeof it.id === 'number' && Number.isFinite(it.id));
  if (allHaveId) {
    const out = { selected: items };
    fs.writeFileSync(selFile, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote updated selection file with numeric IDs:', selFile);
  } else {
    console.log('Not writing selection file because some items lack numeric IDs. Current unresolved count:', unresolved.length);
  }
}

main().catch(e => { console.error('error', e); process.exit(1); });

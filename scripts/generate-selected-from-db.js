#!/usr/bin/env node
/*
 Poll for the latest pipeline-summary-*.json (optionally newer than --since ms timestamp),
 then query Supabase for authoritative Article rows and write tmp/selected.json with id,slug,title,excerpt.

 Usage:
  node scripts/generate-selected-from-db.js            # poll up to 120s for any pipeline-summary, then generate tmp/selected.json
  node scripts/generate-selected-from-db.js --since 1757820000000 --timeout 60
  node scripts/generate-selected-from-db.js --out tmp/selected.json
*/

const fs = require('fs');
const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const TMP = path.join(process.cwd(), 'tmp');
const outPath = path.resolve(argv.out || path.join(TMP, 'selected.json'));
const since = argv.since ? Number(argv.since) : null; // ms timestamp
const timeout = argv.timeout ? Number(argv.timeout) * 1000 : 120000; // ms
const pollInterval = argv.interval ? Number(argv.interval) : 2000;

// Supabase client
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  process.exit(1);
}
let createClient;
try {
  createClient = require('@supabase/supabase-js').createClient;
} catch (e) {
  console.error('Please install @supabase/supabase-js in this project to run this script.');
  process.exit(1);
}
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

function listSummaryFiles() {
  if (!fs.existsSync(TMP)) return [];
  return fs.readdirSync(TMP).filter(f => f.startsWith('pipeline-summary-') && f.endsWith('.json'));
}

function parseSummaryFile(p) {
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const j = JSON.parse(raw);
    const createdAt = j && j.createdAt ? Date.parse(j.createdAt) : null;
    return { path: p, json: j, ts: createdAt || Number(p.match(/pipeline-summary-(\d+)\.json/)?.[1]) || 0 };
  } catch (e) { return null; }
}

function slugifyTitle(s) {
  if (!s) return null;
  return String(s)
    .toLowerCase()
    .replace(/[\s\t\n\r]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function findAllSummaries(minTs) {
  const files = listSummaryFiles();
  const parsed = [];
  for (const f of files) {
    const p = path.join(TMP, f);
    const s = parseSummaryFile(p);
    if (!s) continue;
    if (minTs && s.ts <= minTs) continue;
    parsed.push(s);
  }
  // sort ascending by timestamp so older summaries appear first
  parsed.sort((a, b) => a.ts - b.ts);
  return parsed;
}

async function pollForSummaries() {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = findAllSummaries(since);
    if (found && found.length) return found;
    await new Promise(r => setTimeout(r, pollInterval));
  }
  return null;
}

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

(async function main() {
  try {
    console.log('Waiting for pipeline-summary(s)... (timeout', timeout, 'ms)');

    let summaries = null;
    if (since) {
      // when --since is provided, aggregate all summaries newer than since
      summaries = await pollForSummaries();
      if (!summaries || !summaries.length) {
        console.error('No pipeline-summary found within timeout for --since. Exiting.');
        process.exit(2);
      }
      console.log('Aggregating pipeline summaries since', since, ':', summaries.map(f => f.path).join(', '));
    } else {
      // default behavior: wait for the single latest summary
      const all = findAllSummaries();
      // find the single latest
      if (!all || !all.length) {
        // poll until any summary appears
        const foundArr = await pollForSummaries();
        if (!foundArr || !foundArr.length) {
          console.error('No pipeline-summary found within timeout. Exiting.');
          process.exit(2);
        }
        summaries = [ foundArr[foundArr.length - 1] ];
      } else {
        summaries = [ all[all.length - 1] ];
      }
      console.log('Processing latest pipeline summary only:', summaries[0].path);
    }

    // collect items across selected summaries
    const collected = [];
    for (const s of summaries) {
      const items = (s.json && Array.isArray(s.json.items)) ? s.json.items : [];
      for (const it of items) collected.push({ srcPath: s.path, ts: s.ts, item: it });
    }

    // dedupe by id (preferred) then slug
    const byKey = new Map(); // key -> { id, slug, srcPath, ts, item }
    for (const entry of collected) {
      const it = entry.item || {};
      const id = (typeof it.id !== 'undefined' && it.id !== null) ? String(it.id) : null;
      const slug = it.slug || null;
      let key = id || (slug ? `slug:${slug}` : null);
      if (!key) {
        // no id or slug, create a synthetic key using title + ts
        key = `anon:${it.title || ''}:${entry.ts}`;
      }
      // prefer later summary (higher ts) to override earlier
      const prev = byKey.get(key);
      if (!prev || entry.ts >= prev.ts) {
        byKey.set(key, { id: id ? Number(id) : null, slug, srcPath: entry.srcPath, ts: entry.ts, item: it });
      }
    }

    const uniqEntries = Array.from(byKey.values());

    // If the UI wrote a selection file, prefer those slugs/oldSlugs as authoritative
    const selectionFile = path.join(process.cwd(), 'tmp', 'selection-to-pipeline.json');
    let selectionMap = null;
    try {
      if (fs.existsSync(selectionFile)) {
        const raw = fs.readFileSync(selectionFile, 'utf8');
        const sel = JSON.parse(raw);
        if (sel && Array.isArray(sel.selected)) {
          selectionMap = new Map();
          for (const s of sel.selected) {
            try {
              const keyId = s.id ? String(s.id) : null;
              const keySlug = s.slug ? String(s.slug) : (s.slug || null);
              const keyTitle = s.title ? String(s.title).trim().toLowerCase() : null;
              const entry = { slug: s.slug || s.slug, oldSlug: s.oldSlug || s.oldslug || (s.slug ? String(s.slug) : null) };
              if (keyId) selectionMap.set(`id:${keyId}`, entry);
              if (keySlug) selectionMap.set(`slug:${keySlug}`, entry);
              if (keyTitle) selectionMap.set(`title:${keyTitle}`, entry);
            } catch (e) { /* ignore malformed selection entries */ }
          }
        }
      }
    } catch (e) { /* best-effort; ignore */ }

    const outItems = [];
    for (const e of uniqEntries) {
      const slug = e.slug || null;
      const id = (typeof e.id !== 'undefined' && e.id !== null) ? Number(e.id) : null;
      // try to find a matching selection entry
      let selMatch = null;
      try {
        if (selectionMap) {
          if (id && selectionMap.has(`id:${String(id)}`)) selMatch = selectionMap.get(`id:${String(id)}`);
          if (!selMatch && slug && selectionMap.has(`slug:${String(slug)}`)) selMatch = selectionMap.get(`slug:${String(slug)}`);
          if (!selMatch && e.item && e.item.title) {
            const tkey = `title:${String(e.item.title).trim().toLowerCase()}`;
            if (selectionMap.has(tkey)) selMatch = selectionMap.get(tkey);
          }
        }
      } catch (e) { selMatch = null }
      const fetched = await fetchArticleBySlugOrId({ id, slug });
      if (fetched) {
        const itemOut = { id: fetched.id, slug: fetched.slug, title: fetched.title || null, excerpt: fetched.excerpt || null };
        // If the UI selection file provided a slug, prefer it unconditionally
        if (selMatch && selMatch.oldSlug) {
          itemOut.oldslug = selMatch.oldSlug;
        } else if (fetched.oldslug) {
          itemOut.oldslug = fetched.oldslug;
        } else if (itemOut.title) {
          itemOut.oldslug = slugifyTitle(itemOut.title);
        }
        outItems.push(itemOut);
      } else {
        const it = e.item || {};
        const itemOut = { id: id || null, slug: slug || null, title: it.title || null, excerpt: it.excerpt || null };
        // If the UI selection file provided a slug, prefer it unconditionally
        if (selMatch && selMatch.oldSlug) {
          itemOut.oldslug = selMatch.oldSlug;
        } else if (it.oldSlug || it.oldslug) {
          itemOut.oldslug = it.oldSlug || it.oldslug;
        } else if (itemOut.title) {
          itemOut.oldslug = slugifyTitle(itemOut.title);
        }
        outItems.push(itemOut);
      }
    }

    // If a selection file is present, prefer the UI-provided slug for matched items.
    // Use a lightweight word-overlap heuristic to match slightly different titles.
    const selList = [];
    try {
      if (selectionMap) {
        // reconstruct a simple list from the selectionMap entries
        for (const [k, v] of selectionMap.entries()) {
          // keys can be id:..., slug:..., title:...
          if (k.startsWith('slug:') || k.startsWith('title:') || k.startsWith('id:')) {
            selList.push({ key: k, slug: v.oldSlug || v.slug || null });
          }
        }
      }
    } catch (e) { /* ignore */ }

    // normalize titles to word sets for overlap matching
    function wordsOf(s) {
      if (!s) return [];
      return String(s).toLowerCase().replace(/["'“”‘’()\[\],.:;?!\/]/g, ' ').split(/\s+/).filter(Boolean);
    }

  for (const outItem of outItems) {
      const outWords = new Set(wordsOf(outItem.title || outItem.slug || ''));
      for (const sel of selList) {
        try {
          const selKey = String(sel.key || '');
          // extract title form title: keys
          if (!sel.slug) continue;
          const maybeTitle = selKey.startsWith('title:') ? selKey.slice('title:'.length) : null;
          const selWords = new Set(wordsOf(maybeTitle || sel.slug || ''));
          let overlap = 0;
          for (const w of selWords) if (outWords.has(w)) overlap++;
          if (overlap >= 2) {
            // treat as a match and force oldslug from selection
            outItem.oldslug = sel.slug;
            break;
          }
        } catch (e) { /* ignore */ }
      }
    }

    const out = { count: outItems.length, items: outItems, createdAt: new Date().toISOString(), sourceSummaries: summaries.map(f => f.path) };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log('Wrote', outPath);
    process.exit(0);
  } catch (e) {
    console.error('Error generating selected.json', e && e.message ? e.message : e);
    process.exit(3);
  }
})();

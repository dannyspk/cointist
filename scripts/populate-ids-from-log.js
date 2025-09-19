// Parse selection and resolve IDs by querying the local API (/api/articles/:slug)
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
const selPath = path.join(repoRoot, 'tmp', 'selection-from-pipeline.json');
const selRaw = fs.readFileSync(selPath, 'utf8');
let selection;
try {
  selection = JSON.parse(selRaw);
} catch (err) {
  console.error('Failed to parse selection JSON:', err.message);
  process.exit(3);
}

if (!Array.isArray(selection.selected)) {
  console.error('Unexpected selection file format: missing `selected` array.');
  process.exit(4);
}

// ensure a fetch implementation is available in this Node environment
let fetchImpl = globalThis.fetch;
if (!fetchImpl) {
  try { fetchImpl = require('node-fetch'); } catch (e) { fetchImpl = null; }
}
if (!fetchImpl) {
  console.error('No fetch available in this Node runtime. Install node-fetch or run with Node 18+.');
  process.exit(5);
}

async function resolveFromDb() {
  let updated = 0;
  const unresolved = [];
  // Build a map of rephraser-produced slug -> id from pipeline-summary-*.json files
  const summaryMap = {};
  const summaryEntries = [];
  try {
    const files = fs.readdirSync(path.join(repoRoot, 'tmp'));
    for (const f of files) {
      if (!f.startsWith('pipeline-summary-') || !f.endsWith('.json')) continue;
      try {
        const p = path.join(repoRoot, 'tmp', f);
        const raw = fs.readFileSync(p, 'utf8');
        const j = JSON.parse(raw);
        if (j && Array.isArray(j.items)) {
            // determine createdAt for this summary (prefer j.createdAt else try parsing filename timestamp)
            const createdAtIso = j.createdAt || null;
            const createdAtTs = createdAtIso ? (new Date(createdAtIso)).getTime() : null;
            for (const it of j.items) {
              if (it && it.slug && (typeof it.id !== 'undefined' && it.id !== null)) {
                const slug = String(it.slug).trim();
                const id = Number(it.id);
                const title = it.title ? String(it.title).trim() : null;
                const excerpt = (typeof it.excerpt !== 'undefined' && it.excerpt !== null) ? String(it.excerpt).trim() : null;
                const existing = summaryMap[slug];
                // prefer entry with newer createdAt; if createdAtTs is null, prefer newer file order (overwrite)
                if (!existing) {
                  summaryMap[slug] = { id, createdAt: createdAtTs || Date.now(), title, excerpt };
                } else {
                  const exTs = existing.createdAt || 0;
                  const newTs = createdAtTs || Date.now();
                  if (newTs >= exTs) {
                    summaryMap[slug] = { id, createdAt: newTs, title, excerpt };
                  }
                }
                summaryEntries.push({ slug, id, title, excerpt, createdAt: summaryMap[slug].createdAt });
              }
            }
        }
      } catch (e) { /* ignore malformed summaries */ }
    }
  } catch (e) { /* ignore read errors */ }
  // Also preload rephraser log contents so we can map original (old) slugs to rephrased slugs+ids
  const rephraserLogs = {};
  try {
    const files = fs.readdirSync(path.join(repoRoot, 'tmp'));
    for (const f of files) {
      if (!f.includes('rephraser') || !f.endsWith('.log')) continue;
      try {
        const p = path.join(repoRoot, 'tmp', f);
        rephraserLogs[p] = fs.readFileSync(p, 'utf8');
      } catch (e) { /* ignore */ }
    }
  } catch (e) { /* ignore */ }
  // helper: given a needle, find the last Supabase select match after the needle across rephraser logs
  function findLastRephraserMatch(needle) {
    if (!needle) return null;
    const normNeedle = String(needle).trim();
    let best = null; // { id, slug, ts }
    const isoRe = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/g;
    const selectRe = /Supabase select raw response for slug:\s*(\{[\s\S]*?\})/g;
    for (const txt of Object.values(rephraserLogs)) {
      const idx = txt.indexOf(normNeedle);
      if (idx === -1) continue;
      let m;
      while ((m = selectRe.exec(txt)) !== null) {
        const matchIndex = m.index;
        if (matchIndex <= idx) continue;
        // find last ISO timestamp before this match
        const head = txt.slice(0, matchIndex);
        let t;
        let im;
        while ((im = isoRe.exec(head)) !== null) t = im[1];
        let ts = null;
        if (t) ts = (new Date(t)).getTime();
        try {
          const parsed = JSON.parse(m[1]);
          if (parsed && parsed.data && parsed.data.slug && (typeof parsed.data.id !== 'undefined' && parsed.data.id !== null)) {
            const candidate = { id: Number(parsed.data.id), slug: String(parsed.data.slug).trim(), ts: ts || 0 };
            if (!best || (candidate.ts > best.ts)) best = candidate;
          }
        } catch (e) { /* ignore parse errors */ }
      }
    }
    return best;
  }
  for (const item of selection.selected) {
  // Prefer the most recent authoritative mapping: compare pipeline-summary entries, fuzzy matches, and rephraser log's last match
    let found = false;
    const tryKeys = [];
    if (item.slug) tryKeys.push(String(item.slug).trim());
    if (item.oldSlug) tryKeys.push(String(item.oldSlug).trim());
    // find summary entry for first available key
  let summaryEntry = null;
    for (const k of tryKeys) {
      if (summaryMap[k]) { summaryEntry = summaryMap[k]; break; }
    }
    // find last rephraser match (search by oldSlug then slug then title)
    let rephraserMatch = null;
    if (item.oldSlug) rephraserMatch = findLastRephraserMatch(item.oldSlug);
    if (!rephraserMatch && item.slug) rephraserMatch = findLastRephraserMatch(item.slug);
    if (!rephraserMatch && item.title) rephraserMatch = findLastRephraserMatch(item.title);
    // assignedTs: timestamp of whatever mapping we choose before possible rephraser override
    let assignedTs = null;
    let assignedFrom = null; // 'summary'|'fuzzy'|'rephraser'
    if (summaryEntry) {
  item.id = summaryEntry.id;
  if (summaryEntry.title) item.title = summaryEntry.title;
    if (summaryEntry.excerpt) { item.summary = summaryEntry.excerpt; item.excerpt = summaryEntry.excerpt }
      assignedTs = summaryEntry.createdAt || 0;
      assignedFrom = 'summary';
      updated++;
      found = true;
    }
    // If still not found, try fuzzy title match against rephraser summary entries
    if (!found && item.title && summaryEntries.length) {
      const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).filter(w => w.length>3 && !['about','from','with','that','this','their','they','there','which','while','what','when','where'].includes(w));
      const a = normalize(item.title);
      let best = { score: 0, entry: null };
      const aset = new Set(a);
      for (const e of summaryEntries) {
        if (!e.title) continue;
        const b = normalize(e.title);
        if (!b.length) continue;
        let common = 0;
        for (const w of b) if (aset.has(w)) common++;
        const score = common / Math.min(a.length || 1, b.length);
        if (score > best.score) best = { score, entry: e };
      }
      if (best.entry && (best.score >= 0.5 || (best.score > 0 && best.entry.title && best.entry.title.split(' ').length <= 6 && best.score >= 0.4) || best.score * (a.length||1) >= 3)) {
        item.id = best.entry.id;
  if (best.entry.title) item.title = best.entry.title;
  if (best.entry.excerpt) { item.summary = best.entry.excerpt; item.excerpt = best.entry.excerpt }
        assignedTs = best.entry.createdAt || 0;
        assignedFrom = 'fuzzy';
        updated++;
        found = true;
      }
    }
    // Fallback: query the local API using slugs
    const trySlugs = [];
    if (!found) {
      if (item.slug) trySlugs.push(item.slug);
      if (item.oldSlug && item.oldSlug !== item.slug) trySlugs.push(item.oldSlug);
      for (const s of trySlugs) {
        if (!s) continue;
        try {
          const url = `http://localhost:3000/api/articles/${encodeURIComponent(s)}`;
          const r = await fetchImpl(url, { method: 'GET' });
          if (r.status === 200) {
            const json = await r.json();
            if (json && json.id) {
              item.id = Number(json.id);
              updated++;
              found = true;
              break;
            }
          }
        } catch (e) {
          // network error talking to local server; treat as unresolved and break
          console.error('Error querying local API for slug', s, e && e.message ? e.message : e);
          unresolved.push({ slug: item.slug || null, reason: 'api-error', detail: String(e && e.message ? e.message : e) });
          found = false;
          break;
        }
      }
    }
    // Now that we've tried summary/fuzzy/api, allow rephraserMatch (computed earlier) to override if it's newer
  if (rephraserMatch) {
      const rts = rephraserMatch.ts || 0;
      if (!assignedFrom) {
        // we haven't assigned yet, so take rephraserMatch
  item.id = rephraserMatch.id;
  item.slug = rephraserMatch.slug;
  if (rephraserMatch.title) item.title = rephraserMatch.title;
  if (rephraserMatch.excerpt) { item.summary = rephraserMatch.excerpt; item.excerpt = rephraserMatch.excerpt }
        assignedFrom = 'rephraser';
        assignedTs = rts;
        updated++;
        found = true;
      } else if (rts && rts >= (assignedTs || 0)) {
        // override earlier assignment if rephraser is newer
  item.id = rephraserMatch.id;
  item.slug = rephraserMatch.slug;
  if (rephraserMatch.title) item.title = rephraserMatch.title;
  if (rephraserMatch.excerpt) { item.summary = rephraserMatch.excerpt; item.excerpt = rephraserMatch.excerpt }
        assignedFrom = 'rephraser';
        assignedTs = rts;
        found = true;
      }
    }
  // If still not found, try to find a mapping from original slug/title -> rephrased slug by scanning rephraser logs
    if (!found && (item.oldSlug || item.slug || item.title)) {
      const needle = String(item.oldSlug || item.slug || item.title || '').trim();
      if (needle) {
        for (const [p, txt] of Object.entries(rephraserLogs)) {
          const idx = txt.indexOf(needle);
          if (idx === -1) continue;
          // find ALL Supabase select JSON matches and pick the last one that occurs after the needle
          const re = /Supabase select raw response for slug:\s*(\{[\s\S]*?\})/g;
          let m;
          let lastParsed = null;
          while ((m = re.exec(txt)) !== null) {
            const matchIndex = m.index;
            if (matchIndex > idx) {
              try {
                const parsed = JSON.parse(m[1]);
                if (parsed && parsed.data && parsed.data.slug && (typeof parsed.data.id !== 'undefined' && parsed.data.id !== null)) {
                  lastParsed = parsed;
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
          if (lastParsed) {
            // if we already assigned from summary/fuzzy, only override if rephraser timestamp is newer
            const candidateTs = lastParsed._ts || 0; // _ts will be set by findLastRephraserMatch
            const candidate = { id: Number(lastParsed.data.id), slug: String(lastParsed.data.slug).trim(), ts: candidateTs };
            if (!assignedFrom) {
              item.id = candidate.id;
              item.slug = candidate.slug;
              assignedFrom = 'rephraser';
              assignedTs = candidate.ts || 0;
              updated++;
              found = true;
            } else if (candidate.ts && candidate.ts >= (assignedTs || 0)) {
              // override earlier assignment
              item.id = candidate.id;
              item.slug = candidate.slug;
              assignedFrom = 'rephraser';
              assignedTs = candidate.ts || 0;
              // don't increment updated again (already counted)
              found = true;
            }
          }
          if (found) break;
        }
      }
    }

  // no special forbidden-id rules here; allow the pipeline's rephraser-assigned ids
    if (!found) {
      unresolved.push({ slug: item.slug || null, oldSlug: item.oldSlug || null, reason: 'not-found' });
    }
  }

  // Non-fatal: write whatever authoritative ids we resolved and report unresolved items
  const bak = selPath + '.bak';
  fs.copyFileSync(selPath, bak);
  fs.writeFileSync(selPath, JSON.stringify(selection, null, 2), 'utf8');
  console.log(`Wrote ${selPath} (backup at ${bak}). Updated ${updated} items.`);
  if (unresolved.length) {
    console.warn('The following items could not be found in the DB (ids left null):');
    console.table(unresolved);
  }
  return { ok: true, updated, unresolved };
}

(async () => {
  const res = await resolveFromDb();
  if (!res.ok) process.exit(2);
  process.exit(0);
})();

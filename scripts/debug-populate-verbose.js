#!/usr/bin/env node
// Verbose debug runner for populate-ids-from-log.js logic
const fs = require('fs');
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
const logPath = path.join(repoRoot, 'tmp', 'pipeline-rephraser.log');
const selPath = path.join(repoRoot, 'tmp', 'selection-from-pipeline.json');
const logRaw = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
const marker = 'Supabase select raw response for slug:';
const map = Object.create(null);
let idx = 0;
while (true) {
  const p = logRaw.indexOf(marker, idx);
  if (p === -1) break;
  const braceStart = logRaw.indexOf('{', p + marker.length);
  if (braceStart === -1) break;
  let depth = 0;
  let i = braceStart;
  for (; i < logRaw.length; i++) {
    const ch = logRaw[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) { idx = p + marker.length; continue; }
  const jsonStr = logRaw.slice(braceStart, i + 1);
  try { const obj = JSON.parse(jsonStr); if (obj && obj.data && obj.data.slug) map[String(obj.data.slug)] = obj.data.id; } catch(e){}
  idx = i + 1;
}
// fallback scanning
if (Object.keys(map).length === 0) {
  const upsertDir = path.join(repoRoot, 'tmp');
  const files = fs.readdirSync(upsertDir).filter(f => /^upserted-.*\.html$/.test(f));
  for (const f of files) {
    const m = f.match(/^upserted-(.+?)\.(?:html)$/);
    if (m) {
      const name = m[1];
      const parts = name.split('-');
      const last = parts[parts.length - 1];
      if (/^[0-9]+$/.test(last)) {
        const slugPart = parts.slice(0, -1).join('-'); map[slugPart] = Number(last);
      } else {
        try {
          const raw = fs.readFileSync(path.join(upsertDir, f), 'utf8');
          const jmatch = raw.match(/\{\s*"id"\s*:\s*([0-9]+)\s*,[\s\S]{0,200}?"slug"\s*:\s*"([^"]+)"/i);
          if (jmatch) { const id = Number(jmatch[1]); const slug = String(jmatch[2]); if (slug && id) map[slug] = id; }
        } catch(e){}
      }
    }
  }
}
console.log('Mappings found:', map);
const selRaw = fs.readFileSync(selPath, 'utf8');
const selection = JSON.parse(selRaw);
function normalize(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
const normalizedMap = {};
for (const k of Object.keys(map)) normalizedMap[normalize(k)] = map[k];
for (const item of selection.selected) {
  console.log('\nItem:', item.slug);
  const candidates = [];
  if (item.oldSlug) candidates.push({type:'oldSlug', slug:item.oldSlug});
  if (item.slug) candidates.push({type:'slug', slug:item.slug});
  let matched = false;
  for (const c of candidates) {
    if (!c.slug) continue;
    console.log(' Checking candidate', c.type, c.slug);
    if (map[c.slug]) { console.log('  Exact map hit ->', map[c.slug]); item.id = map[c.slug]; matched = true; break; }
    const n = normalize(c.slug);
    if (normalizedMap[n]) { console.log('  Normalized map hit ->', normalizedMap[n]); item.id = normalizedMap[n]; matched = true; break; }
  }
  if (matched) continue;
  if (!item.oldSlug && item.slug) {
    const s = item.slug;
    const tokens = s.split(/[-_]/).filter(Boolean).filter(t => t.length >= 3);
    console.log('  Tokens for fuzzy match:', tokens);
    if (tokens.length) {
      let best = {slug:null, score:0, id:null};
      for (const [mSlug,mId] of Object.entries(map)) {
        let score = 0; for (const t of tokens) if (mSlug.includes(t)) score++;
        if (score > best.score) best = {slug:mSlug, score, id:mId};
      }
      console.log('  Best fuzzy:', best);
      if (best.score >= 2) { item.oldSlug = best.slug; item.id = best.id; continue; }
    }
  }
  console.log('  No match for item.');
}
console.log('\nFinal selection:');
console.log(JSON.stringify(selection, null, 2));

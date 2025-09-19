#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const outPath = path.join(ROOT, 'tmp', 'update-via-supabase-summary.json');

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) are required in env.');
  process.exit(2);
}

const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

const checks = [
  { table: 'Article', column: 'coverImage' },
  { table: 'Article', column: 'thumbnail' },
  { table: 'Guides', column: 'coverImage' },
  { table: 'Guides', column: 'thumbnail' }
];

async function fetchRows(table, column) {
  const base = supabaseUrl.replace(/\/$/, '') + `/rest/v1/${table}`;
  const select = `select=id,slug,${column}`;
  const qpng = `${base}?${select}&${column}=ilike.*.png&limit=1000`;
  const qjpg = `${base}?${select}&${column}=ilike.*.jpg&limit=1000`;
  const qjpeg = `${base}?${select}&${column}=ilike.*.jpeg&limit=1000`;
  const arr = [];
  for (const url of [qpng, qjpg, qjpeg]) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const txt = await res.text().catch(()=>`status ${res.status}`);
      throw new Error(`Failed query ${url}: ${txt}`);
    }
    const data = await res.json().catch(()=>null);
    if (!data) continue;
    if (!Array.isArray(data)) {
      // unexpected response
      throw new Error(`Unexpected response type from ${url}`);
    }
    for (const r of data) arr.push(r);
  }
  // de-dupe by id
  const map = new Map();
  for (const r of arr) if (r && r.id != null) map.set(r.id, r);
  return Array.from(map.values());
}

async function patchRow(table, id, column, value) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?id=eq.${id}`;
  const body = {};
  body[column] = value;
  const res = await fetch(url, { method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text().catch(()=>res.statusText);
    throw new Error(`PATCH failed ${res.status}: ${text}`);
  }
  return await res.json().catch(()=>null);
}

(async function(){
  const summary = { generatedAt: new Date().toISOString(), updates: [] };
  for (const chk of checks) {
    try {
      console.log(`Querying ${chk.table}.${chk.column}...`);
      const rows = await fetchRows(chk.table, chk.column);
      console.log(`Found ${rows.length} candidate rows`);
      const updated = [];
      for (const r of rows) {
        const val = r[chk.column];
        if (!val) continue;
        const newVal = val.replace(/\.(png|jpe?g)$/i, '.webp');
        if (newVal === val) continue;
        try {
          await patchRow(chk.table, r.id, chk.column, newVal);
          updated.push({ id: r.id, slug: r.slug || null, from: val, to: newVal });
          console.log(`Updated ${chk.table} id=${r.id}`);
        } catch (e) {
          console.error(`Failed to update ${chk.table} id=${r.id}:`, e.message);
        }
      }
      summary.updates.push({ table: chk.table, column: chk.column, found: rows.length, updated: updated.length, details: updated.slice(0,20) });
    } catch (e) {
      console.error(`Error processing ${chk.table}.${chk.column}:`, e.message);
      summary.updates.push({ table: chk.table, column: chk.column, error: e.message });
    }
  }
  fs.mkdirSync(path.join(ROOT,'tmp'), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log('Done. Summary written to', outPath);
  process.exit(0);
})();

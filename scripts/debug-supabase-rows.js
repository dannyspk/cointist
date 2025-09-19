#!/usr/bin/env node
// Debug Supabase rows to find non-primitive values that sqlite can't bind
const { createClient } = require('@supabase/supabase-js');
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(2);
}
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });

async function main() {
  const { data: articles, error } = await supa.from('Article').select('*');
  if (error || !articles) {
    const alt = await supa.from('articles').select('*');
    if (alt.error) { console.error('Error reading articles:', error || alt.error); process.exit(3); }
  }
  const rows = articles || (await supa.from('articles').select('*')).data || [];
  console.log('Found', rows.length, 'rows');
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (const k of Object.keys(r)) {
      const v = r[k];
      const t = typeof v;
      if (v === null) continue;
      // allow numbers, strings, booleans, bigint
      if (t === 'number' || t === 'string' || t === 'boolean' || t === 'bigint') continue;
      // Buffer is okay, but in Node it may be object; skip Buffer check
      if (Array.isArray(v)) {
        console.log(`Row ${i} col ${k} is Array -> length ${v.length}`);
        continue;
      }
      if (v instanceof Date) { console.log(`Row ${i} col ${k} is Date -> ${v.toISOString()}`); continue; }
      if (t === 'object') {
        console.log(`Row ${i} col ${k} is object (non-primitive). Sample:`, JSON.stringify(v).slice(0,200));
      } else {
        console.log(`Row ${i} col ${k} type ${t}`);
      }
    }
  }
}

main().catch(e=>{ console.error(e); process.exit(99); });

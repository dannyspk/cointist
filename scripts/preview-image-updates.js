#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = process.cwd();
const outPath = path.join(ROOT, 'tmp', 'preview-image-updates.json');

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function runWithPg() {
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    const report = { generatedAt: new Date().toISOString(), checks: [] };

    // helper to check column exists
    async function columnExists(table, column) {
      const res = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2 LIMIT 1`,
        [table, column]
      );
      return res.rowCount > 0;
    }

    async function sampleCount(table, column) {
      const countQ = `SELECT count(*)::int AS cnt FROM "${table}" WHERE "${column}" ~* '\\.(png|jpe?g)$'`;
      const sampleQ = `SELECT id, slug, "${column}" AS value FROM "${table}" WHERE "${column}" ~* '\\.(png|jpe?g)$' LIMIT 10`;
      const cntRes = await client.query(countQ);
      const sampleRes = await client.query(sampleQ);
      return { count: cntRes.rows[0].cnt, samples: sampleRes.rows };
    }

    // Tables/columns to check
    const checks = [
      { table: 'Article', columns: ['coverImage', 'thumbnail'] },
      { table: 'Guides', columns: ['coverImage', 'cover', 'cover_image', 'thumbnail', 'thumbnail_image', 'thumb'] }
    ];

    for (const t of checks) {
      for (const col of t.columns) {
        const exists = await columnExists(t.table, col);
        if (!exists) {
          report.checks.push({ table: t.table, column: col, exists: false });
          continue;
        }
        const data = await sampleCount(t.table, col);
        report.checks.push({ table: t.table, column: col, exists: true, count: data.count, samples: data.samples });
      }
    }

    fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log('Wrote preview to', outPath);
    console.log('Summary:');
    for (const c of report.checks) {
      if (!c.exists) console.log(`${c.table}.${c.column}: (column missing)`);
      else console.log(`${c.table}.${c.column}: ${c.count} rows`);
    }

    await client.end();
    process.exit(0);
  } catch (e) {
    console.error('Preview failed:', e.message);
    try { await client.end(); } catch (er) {}
    process.exit(2);
  }
}

async function runWithSupabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env not found (SUPABASE_URL or key).');
    process.exit(2);
  }
  const report = { generatedAt: new Date().toISOString(), checks: [] };

  const checks = [
    { table: 'Article', columns: ['coverImage', 'thumbnail'] },
    { table: 'Guides', columns: ['coverImage', 'cover', 'cover_image', 'thumbnail', 'thumbnail_image', 'thumb'] }
  ];

  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  // helper to query REST
  async function getCount(table, column) {
    const filter = `or=(${encodeURIComponent(`${column}.ilike.*.png`)},${encodeURIComponent(`${column}.ilike.*.jpg`)},${encodeURIComponent(`${column}.ilike.*.jpeg`)})`;
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?select=id&${filter}`;
    // request with Prefer: count=exact to get Content-Range
    const res = await fetch(url, { method: 'GET', headers: { ...headers, Prefer: 'count=exact' } });
    if (res.status === 404 || res.status === 400) throw new Error(`Table/column not found or invalid: ${table}`);
    const contentRange = res.headers.get('content-range') || res.headers.get('Content-Range');
    let count = null;
    if (contentRange) {
      const parts = contentRange.split('/');
      count = parts[1] === '*' ? null : parseInt(parts[1], 10);
    } else {
      // fallback to body length
      const body = await res.json().catch(() => []);
      count = Array.isArray(body) ? body.length : 0;
    }
    return count || 0;
  }

  async function getSamples(table, column) {
    const filter = `or=(${encodeURIComponent(`${column}.ilike.*.png`)},${encodeURIComponent(`${column}.ilike.*.jpg`)},${encodeURIComponent(`${column}.ilike.*.jpeg`)})`;
    const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/${table}?select=id,slug,${column}&${filter}&limit=10`;
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 404 || res.status === 400) throw new Error(`Table/column not found or invalid: ${table}`);
    const body = await res.json().catch(() => []);
    return body;
  }

  for (const t of checks) {
    for (const col of t.columns) {
      try {
        const cnt = await getCount(t.table, col);
        const samples = await getSamples(t.table, col);
        report.checks.push({ table: t.table, column: col, exists: true, count: cnt, samples });
        console.log(`${t.table}.${col}: ${cnt} rows`);
      } catch (e) {
        report.checks.push({ table: t.table, column: col, exists: false, error: e.message });
        console.log(`${t.table}.${col}: (missing or error)`);
      }
    }
  }

  fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('Wrote preview to', outPath);
  process.exit(0);
}

(async function() {
  if (databaseUrl) return runWithPg();
  return runWithSupabase();
})();

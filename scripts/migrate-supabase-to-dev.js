#!/usr/bin/env node
// Pull articles and articleVersions from Supabase into local prisma/dev.db
// Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, then run:
//   node scripts/migrate-supabase-to-dev.js

const readline = require('readline');
const path = require('path');

async function confirm(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans); }));
}

function isoOrNull(v) {
  if (v === null || v === undefined) return null;
  // If already a Date object
  if (v instanceof Date) return v.toISOString();
  // If looks like number timestamp
  if (typeof v === 'number') return new Date(v).toISOString();
  // else stringify
  return String(v);
}

async function main() {
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SUPA_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(2);
  }

  const { createClient } = require('@supabase/supabase-js');
  const supa = createClient(SUPA_URL, SUPA_KEY);

  try {
    console.log('Fetching articles and versions from Supabase...');
    // Try common table names used in this project
    let { data: articles, error: aErr } = await supa.from('Article').select('*');
    if (aErr || !articles) {
      console.log('Could not read from table "Article"; trying "articles"...');
      ({ data: articles, error: aErr } = await supa.from('articles').select('*'));
    }
    let { data: versions, error: vErr } = await supa.from('ArticleVersion').select('*');
    if (vErr || !versions) {
      console.log('Could not read from table "ArticleVersion"; trying "articleVersion"...');
      ({ data: versions, error: vErr } = await supa.from('articleVersion').select('*'));
    }

    if (aErr) { console.error('Error fetching articles:', aErr); process.exit(3); }
    if (vErr) { console.error('Error fetching versions:', vErr); process.exit(4); }

    articles = articles || [];
    versions = versions || [];
    console.log(`Found ${articles.length} articles and ${versions.length} versions in Supabase.`);

    const ans = await confirm('This will overwrite local prisma/dev.db article and articleVersion tables. Continue? (y/N): ');
    if (!/^y(es)?$/i.test(ans)) { console.log('Aborted by user.'); return; }

    const Database = require('better-sqlite3');
    const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
    const sqlite = new Database(dbPath);

    try {
      // discover columns for article and articleVersion
      function tableCols(table) {
        try {
          const info = sqlite.prepare(`PRAGMA table_info(${table})`).all();
          return info.map(r => r.name);
        } catch (e) {
          return null;
        }
      }

  let articleCols = tableCols('article');
  let versionCols = tableCols('articleVersion');
      if (!articleCols) articleCols = tableCols('Article');
      if (!versionCols) versionCols = tableCols('articleVersion');

      if (!articleCols) { console.error('Could not determine local article table columns.'); process.exit(5); }
      if (!versionCols) { console.error('Could not determine local articleVersion table columns.'); process.exit(6); }

  sqlite.exec('PRAGMA foreign_keys = OFF;');
  // Diagnostic logs to detect parameter mismatch issues
  console.log('Local article columns count:', articleCols.length, 'columns:', articleCols.join(','));
  console.log('Local articleVersion columns count:', versionCols.length, 'columns:', versionCols.join(','));
      // clear existing
      sqlite.prepare('DELETE FROM articleVersion').run();
      sqlite.prepare('DELETE FROM article').run();

      // prepare insert statements dynamically
      const artPlaceholders = articleCols.map(() => '?').join(',');
      const artInsert = sqlite.prepare(`INSERT OR REPLACE INTO article(${articleCols.join(',')}) VALUES (${artPlaceholders})`);
      console.log('Article insert placeholders count:', articleCols.length, 'placeholders string length:', artPlaceholders.length);

      const coercedSamples = [];
      function coerceVal(val, rowIndex, col) {
        if (val === undefined) return null;
        if (val === null) return null;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'bigint' || Buffer.isBuffer(val)) return val;
        if (typeof val === 'boolean') return val ? 1 : 0;
        if (val instanceof Date) return val.toISOString();
        if (Array.isArray(val) || (val && typeof val === 'object')) {
          const s = JSON.stringify(val);
          if (coercedSamples.length < 10) coercedSamples.push({ row: rowIndex, col, sample: s.slice(0,200) });
          return s;
        }
        const s = String(val);
        if (coercedSamples.length < 10) coercedSamples.push({ row: rowIndex, col, sample: s.slice(0,200) });
        return s;
      }

      let artSuccess = 0, artFail = 0;
      for (let i = 0; i < articles.length; i++) {
        const a = articles[i];
        const row = articleCols.map(col => {
          if (a.hasOwnProperty(col)) return coerceVal(a[col], i, col);
          const camel = col.replace(/_([a-z])/g, g => g[1].toUpperCase());
          if (a.hasOwnProperty(camel)) return coerceVal(a[camel], i, col);
          if (/date|at/i.test(col) && (a[col] || a[camel])) return isoOrNull(a[col] || a[camel]);
          const val = a[col] || a[camel] || null;
          return coerceVal(val, i, col);
        });
        if (row.length < articleCols.length) { while (row.length < articleCols.length) row.push(null); }
        else if (row.length > articleCols.length) row.length = articleCols.length;
        try {
          artInsert.run(...row);
          artSuccess++;
        } catch (e) {
          artFail++;
          console.error('Failed inserting article index', i, 'id', a && (a.id || a.slug), 'error:', e && e.message ? e.message : e);
          console.error(e && e.stack ? e.stack : e);
        }
      }
      if (coercedSamples.length) console.log('Coerced sample fields while importing articles:', coercedSamples.slice(0,10));

      const verPlaceholders = versionCols.map(() => '?').join(',');
      const verInsert = sqlite.prepare(`INSERT OR REPLACE INTO articleVersion(${versionCols.join(',')}) VALUES (${verPlaceholders})`);
      console.log('ArticleVersion insert placeholders count:', versionCols.length, 'placeholders string length:', verPlaceholders.length);

      let verSuccess = 0, verFail = 0;
      for (let i = 0; i < versions.length; i++) {
        const v = versions[i];
        const row = versionCols.map(col => {
          if (v.hasOwnProperty(col)) return coerceVal(v[col], i, col);
          const camel = col.replace(/_([a-z])/g, g => g[1].toUpperCase());
          if (v.hasOwnProperty(camel)) return coerceVal(v[camel], i, col);
          if (/date|at/i.test(col) && (v[col] || v[camel])) return isoOrNull(v[col] || v[camel]);
          const val = v[col] || v[camel] || null;
          return coerceVal(val, i, col);
        });
        if (row.length < versionCols.length) { while (row.length < versionCols.length) row.push(null); }
        else if (row.length > versionCols.length) row.length = versionCols.length;
        try {
          verInsert.run(...row);
          verSuccess++;
        } catch (e) {
          verFail++;
          console.error('Failed inserting version index', i, 'error:', e && e.message ? e.message : e);
          console.error(e && e.stack ? e.stack : e);
        }
      }

      sqlite.exec('PRAGMA foreign_keys = ON;');
      console.log(`Import complete. Articles: success=${artSuccess} failed=${artFail}. Versions: success=${verSuccess} failed=${verFail}`);
    } finally {
      try { sqlite.close(); } catch (e) {}
    }

  } catch (e) {
    console.error('Migration failed:', e && e.message ? e.message : e);
    process.exitCode = 7;
  }
}

main();

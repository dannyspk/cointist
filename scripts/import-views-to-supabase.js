/*
  Import local sqlite PageView rows into Supabase Postgres.
  Usage:
    Set env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (required for server inserts)
    Optionally set PAGE_SIZE (default 200) and --dry-run flag.

  Example:
    setx SUPABASE_URL "https://xyz.supabase.co"
    setx SUPABASE_SERVICE_ROLE_KEY "<service-role-key>"
    node scripts/import-views-to-supabase.js --dry-run
    node scripts/import-views-to-supabase.js
*/

const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const pageSizeArg = args.find(a => a.startsWith('--pageSize='));
const pageSize = pageSizeArg ? Number(pageSizeArg.split('=')[1]) : 200;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Aborting.');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
const db = new Database(dbPath, { readonly: true });

async function run() {
  console.log('Reading PageView rows from', dbPath);
  const total = db.prepare('SELECT COUNT(*) as c FROM PageView').get().c;
  console.log('Total rows:', total);
  if (total === 0) {
    console.log('No rows to import.');
    return;
  }

  let offset = 0;
  while (offset < total) {
    const rows = db.prepare('SELECT * FROM PageView ORDER BY id LIMIT ? OFFSET ?').all(pageSize, offset);
    console.log('Fetched', rows.length, 'rows (offset', offset, ')');
    const payload = rows.map(r => ({
      id: r.id,
      articleId: r.articleId || null,
      slug: r.slug || null,
      path: r.path || null,
      referrer: r.referrer || null,
      ipHash: r.ipHash || null,
      uaHash: r.uaHash || null,
      sessionId: r.sessionId || null,
      isBot: r.isBot ? true : false,
      createdAt: r.createdAt
    }));

    if (dryRun) {
      console.log('Dry-run: would insert', payload.length, 'rows into Supabase PageView');
    } else {
      // Insert in batches; use upsert to avoid duplicates by id if table uses id PK
      const { data, error } = await supa.from('PageView').insert(payload, { returning: 'minimal' });
      if (error) {
        console.error('Supabase insert error:', error);
        process.exit(2);
      }
      console.log('Inserted batch OK');
    }

    offset += rows.length;
  }

  console.log('Import complete');
}

run().catch(e => { console.error('fatal', e); process.exit(3); });

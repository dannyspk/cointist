#!/usr/bin/env node
// Copy articles and articleVersions from local prisma dev.db into Supabase
// Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, then run:
//   node scripts/migrate-dev-to-supabase.js

const readline = require('readline');

async function confirm(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPA_URL || !SUPA_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(2);
  }

  // Read directly from the SQLite file to avoid Prisma datasource validation issues
  const Database = require('better-sqlite3');
  const dbPath = require('path').join(process.cwd(), 'prisma', 'dev.db');
  const sqlite = new Database(dbPath, { readonly: true });
  try {
    console.log('Reading articles from local dev.db...');
    const articles = sqlite.prepare('SELECT * FROM article').all();
    const versions = sqlite.prepare('SELECT * FROM articleVersion').all();
    console.log(`Found ${articles.length} articles and ${versions.length} articleVersions in local DB.`);

    const ans = await confirm('Continue and push these to Supabase? This will insert/upsert rows (y/N): ');
    if (!/^y(es)?$/i.test(ans)) {
      console.log('Aborted by user.');
      return;
    }

    const { createClient } = require('@supabase/supabase-js');
    const supa = createClient(SUPA_URL, SUPA_KEY);

    // Upsert articles by slug to avoid id conflicts. Remove id to let Postgres assign if needed.
    const articlesToUpsert = articles.map(a => {
      const { id, createdAt, updatedAt, ...rest } = a;
      // keep dates as ISO strings
      return { ...rest, createdAt: createdAt ? new Date(createdAt).toISOString() : null, updatedAt: updatedAt ? new Date(updatedAt).toISOString() : null };
    });

    console.log('Upserting articles to Supabase (by slug)...');
    for (let i = 0; i < articlesToUpsert.length; i += 100) {
      const batch = articlesToUpsert.slice(i, i + 100);
      const { data, error } = await supa.from('Article').upsert(batch, { onConflict: 'slug' }).select();
      if (error) {
        console.error('Error upserting articles batch:', error);
        process.exitCode = 3;
      } else {
        console.log(`Upserted ${data.length} articles (batch ${i/100 + 1}).`);
      }
    }

    // Insert versions. We attempt to preserve createdAt timestamps.
    const versionsToInsert = versions.map(v => {
      const { id, createdAt, ...rest } = v;
      return { ...rest, createdAt: createdAt ? new Date(createdAt).toISOString() : null };
    });

    console.log('Inserting article versions to Supabase...');
    for (let i = 0; i < versionsToInsert.length; i += 200) {
      const batch = versionsToInsert.slice(i, i + 200);
      const { data, error } = await supa.from('ArticleVersion').insert(batch).select();
      if (error) {
        console.error('Error inserting versions batch:', error);
        process.exitCode = 4;
      } else {
        console.log(`Inserted ${data.length} versions (batch ${i/200 + 1}).`);
      }
    }

    console.log('Migration complete. Verify data in Supabase Table Editor.');
  } catch (e) {
    console.error('Migration failed:', e && e.message ? e.message : e);
    process.exitCode = 5;
  } finally {
    try { sqlite.close(); } catch (e) {}
  }
}

main();

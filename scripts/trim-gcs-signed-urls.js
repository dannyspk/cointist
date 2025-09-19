#!/usr/bin/env node
// Trim GCS signed URLs (or other query params) after the first `.png` occurrence
// Supports Prisma (default) and Supabase (--supabase)
// Usage:
//   node scripts/trim-gcs-signed-urls.js                    # dry-run using Prisma (if available)
//   node scripts/trim-gcs-signed-urls.js --supabase         # dry-run using Supabase (requires SUPABASE_URL & SUPABASE_KEY)
//   node scripts/trim-gcs-signed-urls.js --apply            # perform updates
//   node scripts/trim-gcs-signed-urls.js --limit=50         # limit records processed

function trimAfterPng(s) {
  if (!s || typeof s !== 'string') return s;
  // Find first occurrence of .png (case-insensitive) and keep everything up to it
  const m = s.match(/^(.*?\.png)/i);
  if (m && m[1]) return m[1];
  return s;
}

async function runPrisma(limit, apply) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const where = {
      OR: [
        { coverImage: { contains: '.png' } },
        { thumbnail: { contains: '.png' } }
      ]
    };
    const items = await prisma.article.findMany({
      where,
      select: { id: true, coverImage: true, thumbnail: true },
      take: limit || undefined
    });
    if (!items || items.length === 0) {
      console.log('[trim-gcs][prisma] No matching articles found.');
      return;
    }

    const changes = [];
    for (const it of items) {
      const oldCover = it.coverImage;
      const oldThumb = it.thumbnail;
      const newCover = trimAfterPng(oldCover);
      const newThumb = trimAfterPng(oldThumb);
      if ((oldCover || '') !== (newCover || '') || (oldThumb || '') !== (newThumb || '')) {
        changes.push({ id: it.id, oldCover, newCover, oldThumb, newThumb });
      }
    }
    console.log('[trim-gcs][prisma] Found %d records with potential changes.', changes.length);
    if (changes.length === 0) return;
    for (const c of changes) {
      console.log('id=%s', c.id);
      if (c.oldCover !== c.newCover) console.log('  cover: %s -> %s', c.oldCover, c.newCover);
      if (c.oldThumb !== c.newThumb) console.log('  thumb: %s -> %s', c.oldThumb, c.newThumb);
    }
    if (!apply) {
      console.log('\n[trim-gcs][prisma] Dry-run mode; no changes applied. Re-run with --apply to commit.');
      return;
    }
    console.log('\n[trim-gcs][prisma] Applying updates...');
    let applied = 0;
    for (const c of changes) {
      const data = {};
      if ((c.oldCover || '') !== (c.newCover || '')) data.coverImage = c.newCover || null;
      if ((c.oldThumb || '') !== (c.newThumb || '')) data.thumbnail = c.newThumb || null;
      try {
        await prisma.article.update({ where: { id: c.id }, data });
        applied++;
      } catch (e) {
        console.error('[trim-gcs][prisma] Failed to update id=%s: %s', c.id, String(e && e.message || e));
      }
    }
    console.log('[trim-gcs][prisma] Applied %d updates.', applied);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
}

async function runSupabase(limit, apply) {
  const { createClient } = require('@supabase/supabase-js');
  // Flexible env detection: try several common SUPABASE_* names if set in the environment
  function detectEnv() {
    const e = process.env;
    let url = e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || null;
    let key = e.SUPABASE_KEY || e.SUPABASE_SERVICE_ROLE || e.SUPABASE_SERVICE_ROLE_KEY || e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || null;
    if (!url) {
      // find any env var name that contains 'SUPABASE' and 'URL'
      for (const k of Object.keys(e)) {
        if (k.toUpperCase().includes('SUPABASE') && k.toUpperCase().includes('URL')) { url = e[k]; break; }
      }
    }
    if (!key) {
      // prefer service role key if present, otherwise any key-like var
      for (const k of Object.keys(e)) {
        const up = k.toUpperCase();
        if (up.includes('SUPABASE') && (up.includes('SERVICE') || up.includes('ROLE') || up.includes('KEY') || up.includes('ANON'))) {
          key = e[k];
          if (up.includes('SERVICE') || up.includes('ROLE')) break; // prefer service key
        }
      }
    }
    return { url, key };
  }
  const creds = detectEnv();
  const SUPABASE_URL = creds.url;
  const SUPABASE_KEY = creds.key;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[trim-gcs][supabase] SUPABASE_URL and SUPABASE_KEY are required in env for Supabase mode. Tried common SUPABASE_* names.');
    return;
  }
  const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  // Fetch candidate rows. We fetch up to `limit` rows if provided; otherwise fetch all and filter client-side.
  let { data, error } = await supa.from('Article').select('id,coverImage,thumbnail').limit(limit || 10000);
  if (error) {
    console.error('[trim-gcs][supabase] Error fetching articles:', error.message || error);
    return;
  }
  if (!data || data.length === 0) {
    console.log('[trim-gcs][supabase] No articles returned.');
    return;
  }

  const items = data.filter(it => (it.coverImage || '').toString().toLowerCase().includes('.png') || (it.thumbnail || '').toString().toLowerCase().includes('.png'));
  if (items.length === 0) {
    console.log('[trim-gcs][supabase] No matching articles found.');
    return;
  }

  const changes = [];
  for (const it of items) {
    const oldCover = it.coverimage || it.coverImage || null;
    const oldThumb = it.thumbnail || null;
    const newCover = trimAfterPng(oldCover);
    const newThumb = trimAfterPng(oldThumb);
    if ((oldCover || '') !== (newCover || '') || (oldThumb || '') !== (newThumb || '')) {
      changes.push({ id: it.id, oldCover, newCover, oldThumb, newThumb });
    }
  }

  console.log('[trim-gcs][supabase] Found %d records with potential changes.', changes.length);
  if (changes.length === 0) return;
  for (const c of changes) {
    console.log('id=%s', c.id);
    if (c.oldCover !== c.newCover) console.log('  cover: %s -> %s', c.oldCover, c.newCover);
    if (c.oldThumb !== c.newThumb) console.log('  thumb: %s -> %s', c.oldThumb, c.newThumb);
  }

  if (!apply) {
    console.log('\n[trim-gcs][supabase] Dry-run mode; no changes applied. Re-run with --apply to commit.');
    return;
  }

  console.log('\n[trim-gcs][supabase] Applying updates...');
  let applied = 0;
  for (const c of changes) {
    const dataToUpdate = {};
    if ((c.oldCover || '') !== (c.newCover || '')) dataToUpdate.coverImage = c.newCover || null;
    if ((c.oldThumb || '') !== (c.newThumb || '')) dataToUpdate.thumbnail = c.newThumb || null;
    try {
      const res = await supa.from('Article').update(dataToUpdate).eq('id', c.id).select();
      if (res.error) {
        console.error('[trim-gcs][supabase] Update failed id=%s: %s', c.id, res.error.message || res.error);
      } else {
        applied++;
      }
    } catch (e) {
      console.error('[trim-gcs][supabase] Exception updating id=%s: %s', c.id, String(e && e.message || e));
    }
  }
  console.log('[trim-gcs][supabase] Applied %d updates.', applied);
}

async function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply') || argv.includes('-a');
  const limitArg = argv.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const useSupabase = argv.includes('--supabase') || argv.includes('-s') || (!!process.env.SUPABASE_URL && !!process.env.SUPABASE_KEY);

  console.log('[trim-gcs] Starting; mode=%s; limit=%s; adapter=%s', apply ? 'APPLY' : 'DRY-RUN', String(limit || 'none'), useSupabase ? 'Supabase' : 'Prisma');

  if (useSupabase) {
    await runSupabase(limit, apply);
  } else {
    try {
      // Prisma may not be available in some environments; guard require
      await runPrisma(limit, apply);
    } catch (e) {
      console.error('[trim-gcs] Prisma run failed:', e && e.message || e);
    }
  }
}

main().catch(e => {
  console.error('[trim-gcs] Error', e);
  process.exitCode = 1;
});

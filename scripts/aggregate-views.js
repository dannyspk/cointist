/*
  Aggregate PageView -> PageViewDaily
  Usage: node scripts/aggregate-views.js
  Requires SUPABASE_* env or Prisma DATABASE_URL
*/
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

async function run() {
  const useSupa = !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
  let supa = null;
  let prisma = null;
  if (useSupa) {
    supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  } else {
    try { prisma = require('../src/lib/prisma').default || require('../src/lib/prisma'); } catch(e) { prisma = null; }
  }

  const start = new Date();
  start.setHours(0,0,0,0);
  // process last 30 days by default
  const days = 30;
  const now = new Date();
  for (let d=0; d<days; d++) {
    const dayStart = new Date(); dayStart.setDate(now.getDate() - d); dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
    console.log('Aggregating', dayStart.toISOString().slice(0,10));
    if (useSupa) {
      // Sum views per articleId/slug
      const q = `SELECT COALESCE(articleId,0) as articleId, slug, COUNT(*) as views, COUNT(DISTINCT sessionId) as uniques FROM PageView WHERE createdAt >= '${dayStart.toISOString()}' AND createdAt < '${dayEnd.toISOString()}' GROUP BY articleId, slug`;
      const res = await supa.rpc('sql', { q });
      // Note: using supabase RPC to run raw SQL may not be enabled; fallback to selecting via API and aggregating client-side
      if (res && res.error) {
        // fallback: fetch rows via REST and aggregate manually (not ideal for big volumes)
        const rows = await supa.from('PageView').select('*').gte('createdAt', dayStart.toISOString()).lt('createdAt', dayEnd.toISOString());
        const map = {};
        (rows.data || []).forEach(r=>{
          const key = (r.articleId ? String(r.articleId) : '0') + '|' + (r.slug||'');
          if (!map[key]) map[key] = { articleId: r.articleId || null, slug: r.slug || null, views:0, uniquesSet: new Set() };
          map[key].views++;
          if (r.sessionId) map[key].uniquesSet.add(r.sessionId);
        });
        for (const k of Object.keys(map)) {
          const rec = map[k];
          await supa.from('PageViewDaily').upsert([{ articleId: rec.articleId, slug: rec.slug, day: dayStart.toISOString(), views: rec.views, uniques: rec.uniquesSet.size }], { onConflict: ['articleId','day'] });
        }
      } else {
        // If rpc succeeded, res.data contains rows
        for (const r of (res.data || [])) {
          await supa.from('PageViewDaily').upsert([{ articleId: r.articleid || null, slug: r.slug || null, day: dayStart.toISOString(), views: Number(r.views || 0), uniques: Number(r.uniques || 0) }], { onConflict: ['articleId','day'] });
        }
      }
    } else if (prisma) {
      // Prisma may be backed by SQLite locally which stores createdAt as 'YYYY-MM-DD HH:MM:SS'.
      // Detect sqlite by reading the datasource provider from schema or falling back to env
      let isSqlite = false;
      try {
        // safe heuristic: if DATABASE_URL contains 'file:' or process.env.DATABASE_URL points to sqlite file
        const url = process.env.DATABASE_URL || '';
        if (url.includes('file:') || url.endsWith('.db')) isSqlite = true;
      } catch (e) { isSqlite = false; }

      if (isSqlite) {
        // Use raw SQL aggregation compatible with SQLite date format
        const dayKey = dayStart.toISOString().slice(0,10);
        const q = `SELECT COALESCE(articleId,0) as articleId, slug, COUNT(*) as views, COUNT(DISTINCT sessionId) as uniques FROM PageView WHERE date(createdAt) = '${dayKey}' GROUP BY articleId, slug`;
        const rows = prisma.$queryRawUnsafe(q);
        const resolved = await rows;
        for (const r of resolved) {
          const articleId = r.articleId === 0 ? null : r.articleId;
          // upsert via prisma raw SQL for sqlite
          await prisma.$executeRawUnsafe(`INSERT INTO PageViewDaily (articleId, slug, day, views, uniques) VALUES (${articleId === null ? 'NULL' : Number(articleId)}, ${prisma.escape ? prisma.escape(r.slug||'') : `'${(r.slug||'').replace(/'/g,"''")}'`}, date('${dayKey}'), ${Number(r.views||0)}, ${Number(r.uniques||0)})`);
        }
      } else {
        const rows = await prisma.pageView.findMany({ where: { createdAt: { gte: dayStart, lt: dayEnd } } });
        const map = {};
        rows.forEach(r=>{
          const key = (r.articleId ? String(r.articleId) : '0') + '|' + (r.slug||'');
          if (!map[key]) map[key] = { articleId: r.articleId || null, slug: r.slug || null, views:0, uniquesSet: new Set() };
          map[key].views++;
          if (r.sessionId) map[key].uniquesSet.add(r.sessionId);
        });
        for (const k of Object.keys(map)) {
          const rec = map[k];
          await prisma.pageViewDaily.upsert({ where: { articleId_day: { articleId: rec.articleId, day: dayStart } }, update: { views: rec.views, uniques: rec.uniquesSet.size }, create: { articleId: rec.articleId, slug: rec.slug, day: dayStart, views: rec.views, uniques: rec.uniquesSet.size } });
        }
      }
    } else {
      console.error('No supersource configured; cannot aggregate');
      return;
    }
  }
  console.log('Done');
}

run().catch(e=>{ console.error('aggregate error', e); process.exit(1); });

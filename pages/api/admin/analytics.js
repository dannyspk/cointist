import { requireAdmin } from '../../../src/lib/auth';
import fs from 'fs';
import path from 'path';
// try to load Supabase or Prisma
let supa = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  try { const { createClient } = require('@supabase/supabase-js'); supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } }); } catch(e){ supa = null; }
}
let prisma = null;
try { prisma = require('../../../src/lib/prisma').default || require('../../../src/lib/prisma'); } catch(e) { prisma = null; }

function readLogs() {
  const out = path.resolve(process.cwd(), 'logs', 'views.jsonl');
  if (!fs.existsSync(out)) return [];
  const lines = fs.readFileSync(out, 'utf8').split('\n').filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch(e){ return null } }).filter(Boolean);
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === 'GET') {
    // If Supabase aggregated table exists, prefer it
    try {
      if (supa) {
        // fetch top by views from PageViewDaily aggregated table
        const last7 = new Date(); last7.setDate(last7.getDate() - 6);
        const seriesRes = await supa.from('PageViewDaily').select('day,views').gte('day', last7.toISOString()).order('day', { ascending: true });
        const topRes = await supa.from('PageViewDaily').select('slug,articleId,views').order('views', { ascending: false }).limit(25);
        const seriesMap = {};
        (seriesRes.data || []).forEach(r => { const k = (new Date(r.day)).toISOString().slice(0,10); seriesMap[k] = (seriesMap[k] || 0) + (r.views || 0); });
        const series = [];
        for (let i=6;i>=0;i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0,10); series.push({ day: k, views: seriesMap[k] || 0 }); }
        const top = (topRes.data || []).map(r => ({ key: r.articleId ? String(r.articleId) : (r.slug ? `slug:${r.slug}` : 'unknown'), views: r.views || 0 }));
        // total views from daily sums
        const totalRes = await supa.from('PageViewDaily').select('views', { aggregate: 'sum' });
        const total = totalRes && totalRes.data && totalRes.data[0] && totalRes.data[0].sum ? Number(totalRes.data[0].sum) : 0;
        return res.json({ totalViews: total, top, series });
      }
      if (prisma) {
        // query PageViewDaily directly
        const last7 = new Date(); last7.setDate(last7.getDate() - 6);
        const rows = await prisma.pageViewDaily.findMany({ where: { day: { gte: last7 } } });
        const seriesMap = {};
        rows.forEach(r => { const k = (new Date(r.day)).toISOString().slice(0,10); seriesMap[k] = (seriesMap[k] || 0) + (r.views || 0); });
        const series = [];
        for (let i=6;i>=0;i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = d.toISOString().slice(0,10); series.push({ day: k, views: seriesMap[k] || 0 }); }
        const topRows = await prisma.$queryRaw`SELECT slug, articleId, SUM(views) as views FROM PageViewDaily GROUP BY slug, articleId ORDER BY views DESC LIMIT 25`;
        const top = (topRows || []).map(r => ({ key: r.articleId ? String(r.articleId) : (r.slug ? `slug:${r.slug}` : 'unknown'), views: Number(r.views || 0) }));
        const total = await prisma.pageViewDaily.aggregate({ _sum: { views: true } });
        return res.json({ totalViews: (total && total._sum && total._sum.views) || 0, top, series });
      }
    } catch (e) { console.error('[api/admin/analytics] db branch failed', e); }

    // Fallback to reading JSONL
    const logs = readLogs();
    const totals = {};
    const byDay = {};
    const last7 = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    for (const l of logs) {
      const key = l.id ? String(l.id) : (l.slug ? `slug:${l.slug}` : 'unknown');
      totals[key] = (totals[key] || 0) + 1;
      const d = (new Date(l.ts)).toISOString().slice(0,10);
      byDay[d] = (byDay[d] || 0) + 1;
    }
    // compute top articles
    const top = Object.keys(totals).map(k=>({ key:k, views:totals[k] })).sort((a,b)=>b.views-a.views).slice(0,25);
    // compute last 7 days series
    const series = [];
    for (let i=6;i>=0;i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0,10);
      series.push({ day: k, views: byDay[k] || 0 });
    }
    return res.json({ totalViews: logs.length, top, series });
  }

  if (req.method === 'DELETE') {
    // clear logs
    const out = path.resolve(process.cwd(), 'logs', 'views.jsonl');
    try { if (fs.existsSync(out)) fs.unlinkSync(out); return res.json({ ok: true }); } catch(e){ return res.status(500).json({ error: 'failed' }); }
  }

  res.setHeader('Allow', ['GET','DELETE']);
  res.status(405).end();
}

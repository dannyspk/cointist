import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Try to lazy-load Prisma and Supabase where available
let prisma = null;
try { prisma = require('../../../src/lib/prisma').default || require('../../../src/lib/prisma'); } catch(e) { prisma = null; }
let supa = null;
if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)) {
  try { const { createClient } = require('@supabase/supabase-js'); supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } }); } catch(e) { supa = null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const ip = req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    const secret = process.env.ANALYTICS_SECRET || process.env.JWT_SECRET || 'dev-secret';
    const h = (s) => s ? crypto.createHmac('sha256', secret).update(String(s)).digest('hex') : null;
    const rec = {
      ts: new Date().toISOString(),
      id: body.id || null,
      slug: body.slug || null,
      ref: body.ref || null,
      path: body.path || null,
      ipHash: h(ip),
      uaHash: h(ua),
      sessionId: body.sessionId || null,
      isBot: !!body.isBot
    };
    const logsDir = path.resolve(process.cwd(), 'logs');
    try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); } catch(e){}
    // If Supabase is configured, insert into PageView table
    if (supa) {
      try {
        await supa.from('PageView').insert([{
          articleId: rec.id || null,
          slug: rec.slug || null,
          path: rec.path || null,
          referrer: rec.ref || null,
          ipHash: rec.ipHash,
          uaHash: rec.uaHash,
          sessionId: rec.sessionId || null,
          isBot: rec.isBot || false,
        }]);
        return res.json({ ok: true });
      } catch (e) { console.error('[track/view] supa insert failed', e); }
    }

    // If Prisma client available, insert into DB
    if (prisma) {
      try {
        await prisma.pageView.create({ data: {
          articleId: rec.id || null,
          slug: rec.slug || null,
          path: rec.path || null,
          referrer: rec.ref || null,
          ipHash: rec.ipHash,
          uaHash: rec.uaHash,
          sessionId: rec.sessionId || null,
          isBot: rec.isBot || false,
        } });
        return res.json({ ok: true });
      } catch (e) { console.error('[track/view] prisma insert failed', e); }
    }

    // Fallback to JSONL
    const out = path.join(logsDir, 'views.jsonl');
    fs.appendFileSync(out, JSON.stringify(rec) + '\n');
    return res.json({ ok: true });
  } catch (e) {
    console.error('[track/view] error', e);
    return res.status(500).json({ error: 'internal' });
  }
}

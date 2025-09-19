import { requireAdmin } from '../../../src/lib/auth';
import db from '../../../src/lib/db';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method === 'GET') {
    // fetch unpublished articles and filter for scheduled items
    try {
      const items = await db.findArticles({ where: { published: false }, take: 1000 });
      const scheduled = (items || []).filter(it => it.scheduledAt);
      // normalize date strings
      const mapped = scheduled.map(s => ({ id: s.id, title: s.title, slug: s.slug, scheduledAt: s.scheduledAt }));
      return res.json({ data: mapped });
    } catch (e) { console.error('[api/admin/schedule] GET', e); return res.status(500).json({ error: 'failed' }); }
  }

  if (req.method === 'PUT') {
    // update scheduledAt for an article
    try {
      const { id, scheduledAt } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id required' });
      const payload = { scheduledAt: scheduledAt ? new Date(scheduledAt) : null };
      const updated = await db.updateArticle(id, payload);
      return res.json({ ok: true, updated });
    } catch (e) { console.error('[api/admin/schedule] PUT', e); return res.status(500).json({ error: 'failed' }); }
  }

  res.setHeader('Allow', ['GET','PUT']);
  res.status(405).end();
}

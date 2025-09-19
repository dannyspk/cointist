import prisma from '../../../src/lib/prisma';
import db from '../../../src/lib/db';
import { requireAdmin } from '../../../src/lib/auth';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const { articleId } = req.query;
      if (!articleId) return res.status(400).json({ error: 'missing articleId' });
  const items = await prisma.articleVersion.findMany({ where: { articleId: Number(articleId) }, orderBy: { createdAt: 'desc' }, take: 50 });
      // shape response
      return res.json(items.map(v => ({ id: v.id, createdAt: v.createdAt, title: v.title, excerpt: v.excerpt, author: v.author })));
    }

    if (req.method === 'POST') {
      const { revert } = req.query;
      if (!revert) return res.status(400).json({ error: 'missing revert id' });
  const version = await prisma.articleVersion.findUnique({ where: { id: Number(revert) } });
      if (!version) return res.status(404).json({ error: 'version not found' });
  const updated = await prisma.article.update({ where: { id: version.articleId }, data: {
        title: version.title,
        excerpt: version.excerpt,
        content: version.content,
        published: version.published,
        publishedAt: version.publishedAt,
        scheduledAt: version.scheduledAt,
        cover: version.cover,
        thumbnail: version.thumbnail,
        tags: version.tags,
        ogTitle: version.ogTitle,
        ogDescription: version.ogDescription,
        ogImage: version.ogImage,
        coverAlt: version.coverAlt,
        thumbnailAlt: version.thumbnailAlt,
      } });
  await prisma.articleVersion.create({ data: {
        articleId: updated.id,
        title: updated.title,
        excerpt: updated.excerpt,
        content: updated.content,
        published: updated.published,
        publishedAt: updated.publishedAt,
        scheduledAt: updated.scheduledAt,
        cover: updated.cover,
        thumbnail: updated.thumbnail,
        tags: updated.tags,
        ogTitle: updated.ogTitle,
        ogDescription: updated.ogDescription,
        ogImage: updated.ogImage,
        coverAlt: updated.coverAlt,
        thumbnailAlt: updated.thumbnailAlt,
        author: req.user?.name || 'admin'
      } });
      return res.json(updated);
    }

    res.status(405).json({ error: 'method not allowed' });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

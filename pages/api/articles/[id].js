import prisma from '../../../src/lib/prisma';
import db from '../../../src/lib/db';
import { requireAdmin } from '../../../src/lib/auth';
import { sanitizeHtml } from '../../../src/lib/sanitize';

function normalizeArticle(row = {}) {
  try {
  // prefer canonical publishedAt only (do not treat updatedAt/createdAt as published evidence)
  const publishedAt = row.publishedAt || row.published_at || row.published_at_iso || null;
    const publishedRaw = typeof row.published !== 'undefined' ? row.published : (typeof row.is_published !== 'undefined' ? row.is_published : (typeof row.published_flag !== 'undefined' ? row.published_flag : null));
    const published = (publishedRaw !== null && typeof publishedRaw !== 'undefined') ? !!publishedRaw : !!publishedAt;
    return { ...row, published, publishedAt: publishedAt || null };
  } catch (e) { return { ...row, published: false, publishedAt: null }; }
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    let art = null;
    // if id looks like a number, prefer numeric lookup
    const asNum = Number(id);
    if (!Number.isNaN(asNum) && Number.isFinite(asNum)) {
      art = db.findArticleById ? await db.findArticleById(asNum) : await prisma.article.findUnique({ where: { id: Number(asNum) } });
    } else {
      art = db.findArticleBySlug ? await db.findArticleBySlug(id) : await prisma.article.findUnique({ where: { slug: String(id) } });
    }
  if (!art) return res.status(404).json({ error: 'Not found' });
  try {
    const debugFlag = String(req.query._debug || '').toLowerCase() === '1' || String(req.query._debug || '').toLowerCase() === 'true';
    const norm = normalizeArticle(art);
    if (debugFlag) {
      return res.json({ ...norm, _raw: { published_at: art.published_at || art.publishedAt || null, updated_at: art.updated_at || art.updatedAt || null, created_at: art.created_at || art.createdAt || null } });
    }
    return res.json(norm);
  } catch (e) { return res.json(normalizeArticle(art)); }
  }

  if (req.method === 'PUT') {
  if (!requireAdmin(req, res)) return;
  // DEBUG: log incoming body for troubleshooting
  try { console.debug && console.debug('API /api/articles/[id] PUT body:', req.body); } catch (e) {}
  // Coerce published to boolean to avoid accidental string values from client
  const { title, category, excerpt, content, coverImage, author, thumbnail, subcategory, pinned, tags, ogTitle, ogDescription, ogImage, scheduledAt, coverAlt, thumbnailAlt, featuredOnly } = req.body;
  const pinnedBool = !!pinned;
  const published = !!req.body.published;
  // server-side validation for required fields only when publishing
  if (published) {
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    if (!excerpt || !String(excerpt).trim()) return res.status(400).json({ error: 'excerpt required' });
    if (!category || !String(category).trim()) return res.status(400).json({ error: 'category required' });
    if (!author || !String(author).trim()) return res.status(400).json({ error: 'author required' });
    if (!tags || !Array.isArray(tags) || tags.length === 0) return res.status(400).json({ error: 'at least one tag required' });
    if (!coverImage || !String(coverImage).trim()) return res.status(400).json({ error: 'coverImage required' });
    if (!thumbnail || !String(thumbnail).trim()) return res.status(400).json({ error: 'thumbnail required' });
    if (!content || !String(content).replace(/<[^>]*>/g,'').trim()) return res.status(400).json({ error: 'content required' });
  }
    try {
  const incomingSlug = req.body.slug;
  const safeContent = sanitizeHtml(content || '');
  const data = { title, category, excerpt, content: safeContent, published, publishedAt: published ? new Date() : null, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, coverImage, thumbnail, subcategory, pinned: pinnedBool, pinnedAt: pinnedBool ? new Date() : null, author, tags: tags ? tags : null, ogTitle: ogTitle || null, ogDescription: ogDescription || null, ogImage: ogImage || null, featuredOnly: !!featuredOnly };
      // If no explicit slug provided, derive from title when available to keep slugs consistent
      if (incomingSlug) data.slug = incomingSlug;
      else if (title && title.trim()) {
        data.slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
      }

      // Ensure canonical field is present and consistent with category/slug
      try {
        const siteUrl = process.env.SITE_URL || 'https://cointist.net';
        const cat = String(data.category || '').trim();
        const catLower = cat.toLowerCase();
        if (data.slug) {
          if (catLower === 'guides') data.canonical = `${siteUrl}/guides/${data.slug}`;
          else data.canonical = `${siteUrl}/${encodeURIComponent(catLower)}/articles/${encodeURIComponent(data.slug)}`;
        }
      } catch (e) { /* ignore canonical generation failure */ }

      // Rotation: if we're pinning this article and the maximum is reached, unpin the oldest pinned article first.
      // Configure MAX_PINNED via env var; default to 6 (matches front-end Editors' Picks pageSize).
      try {
        if (pinnedBool) {
          // default max pinned kept intentionally conservative to match UI — change via env MAX_PINNED
          const maxPinned = Number(process.env.MAX_PINNED || 5);
          // fetch current article to know if this is a new pin
          const current = await db.findArticleById(Number(id));
          const currentlyPinned = current && current.pinned;
          if (!currentlyPinned) {
            const pinnedCount = await db.countArticles({ pinned: true });
            if (pinnedCount >= maxPinned) {
              // best-effort: find oldest pinned via Prisma fallback (complex queries are easier with Prisma)
              try {
                const oldest = await prisma.article.findFirst({ where: { pinned: true, id: { not: Number(id) } }, orderBy: [{ pinnedAt: 'asc' }, { createdAt: 'asc' }] });
                if (oldest) {
                  await prisma.article.update({ where: { id: oldest.id }, data: { pinned: false, pinnedAt: null } });
                }
              } catch (e) {
                // ignore rotation failure
              }
            }
          }
        }
      } catch (rotErr) {
        // Rotation should not block the update; log and continue
        console.error('pin rotation error', rotErr && rotErr.message ? rotErr.message : rotErr);
      }

    try {
  // route update through DB adapter (Prisma locally, Supabase in prod as configured)
  const update = await (db.updateArticle ? db.updateArticle(Number(id), data) : prisma.article.update({ where: { id: Number(id) }, data }));
  // create a new version entry
  try { await (db.createArticleVersion ? db.createArticleVersion({ articleId: update.id, title: update.title, excerpt: update.excerpt || null, content: update.content || '', data: { update } }) : prisma.articleVersion.create({ data: { articleId: update.id, title: update.title, excerpt: update.excerpt || null, content: update.content || '', data: { update } } })); } catch(e){}
  return res.json(update);
    } catch (e) {
        // retry without scheduledAt if schema mismatch
        const msg = String(e.message || '').toLowerCase();
        if (msg.includes('scheduledat') || msg.includes('unknown argument') || msg.includes('could not find the') || msg.includes('canonical')) {
          // retry without scheduledAt and without canonical if schema doesn't support them
          const data2 = { title, category, excerpt, content: safeContent, published, publishedAt: published ? new Date() : null, coverImage, thumbnail, subcategory, pinned: pinnedBool, pinnedAt: pinnedBool ? new Date() : null, author, tags: tags ? tags : null, ogTitle: ogTitle || null, ogDescription: ogDescription || null, ogImage: ogImage || null, featuredOnly: !!featuredOnly };
          if (incomingSlug) data2.slug = incomingSlug;
          try {
            const update2 = await (db.updateArticle ? db.updateArticle(Number(id), data2) : prisma.article.update({ where: { id: Number(id) }, data: data2 }));
            try { await (db.createArticleVersion ? db.createArticleVersion({ articleId: update2.id, title: update2.title, excerpt: update2.excerpt || null, content: update2.content || '', data: { update: update2 } }) : prisma.articleVersion.create({ data: { articleId: update2.id, title: update2.title, excerpt: update2.excerpt || null, content: update2.content || '', data: { update: update2 } } })); } catch(e){}
            return res.json(update2);
          } catch (e2) { return res.status(500).json({ error: e2.message }); }
        }
        return res.status(500).json({ error: e.message });
      }
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === 'DELETE') {
  if (!requireAdmin(req, res)) return;
    try {
      // route delete through DB adapter when available
      if (db && db.deleteArticle) {
        try { await db.deleteArticle(Number(id)); } catch(e) { /* fall back */ }
      } else {
        await prisma.article.delete({ where: { id: Number(id) } });
      }
      return res.status(204).end();
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', ['GET','PUT','DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

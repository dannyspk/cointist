import prisma from '../../../src/lib/prisma';
import db from '../../../src/lib/db';
import { requireAdmin, checkAdminAuth } from '../../../src/lib/auth';
import { sanitizeHtml } from '../../../src/lib/sanitize';
import scheduler from '../../../src/lib/scheduler';

// Ensure a canonical article shape is returned to clients regardless of underlying DB
function normalizeArticle(row = {}) {
  try {
    const publishedAt = row.publishedAt || row.published_at || row.published_at_iso || null;
    const publishedRaw = typeof row.published !== 'undefined' ? row.published : (typeof row.is_published !== 'undefined' ? row.is_published : (typeof row.published_flag !== 'undefined' ? row.published_flag : null));
    const published = (publishedRaw !== null && typeof publishedRaw !== 'undefined') ? !!publishedRaw : !!publishedAt;
    return { ...row, published, publishedAt: publishedAt || null };
  } catch (e) { return { ...row, published: false, publishedAt: null }; }
}

function normalizeList(items) { return Array.isArray(items) ? items.map(normalizeArticle) : [] }

// Derive a URL-safe slug from a title server-side to ensure consistency
function slugifyTitle(title, maxLen = 80) {
  try {
    const s = String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return s.slice(0, maxLen) || `article-${Date.now().toString(36).slice(-6)}`
  } catch (e) { return `article-${Date.now().toString(36).slice(-6)}` }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
  const { category, subcategory, pinned, q, page = '1', pageSize = '20', excludeId, excludeIds, featuredOnly, sort } = req.query;
  const where = {};
  // By default, the public API should only return published articles.
  // Admins may opt-in to see drafts by passing includeDrafts=1 (or true) and being authenticated.
  const includeDrafts = String(req.query.includeDrafts || '').toLowerCase() === '1' || String(req.query.includeDrafts || '').toLowerCase() === 'true';
  // Dev bypass: when running locally you can set DEV_ALLOW_DRAFTS_WITHOUT_AUTH=1 to let existing-items show drafts without auth.
  const devBypass = process.env.NODE_ENV !== 'production' && ((process.env.DEV_ALLOW_DRAFTS_WITHOUT_AUTH || '').toLowerCase() === '1' || (process.env.DEV_ALLOW_DRAFTS_WITHOUT_AUTH || '').toLowerCase() === 'true');
  if (!includeDrafts) {
    // Only return published articles to public callers
    where.published = true;
  } else {
    if (devBypass) {
      console.debug('[api/articles] includeDrafts allowed by DEV_ALLOW_DRAFTS_WITHOUT_AUTH (dev bypass)');
      // allow drafts without auth in dev when the env var is enabled
    } else {
      // If includeDrafts was requested, ensure the caller is an admin; otherwise ignore and return only published
      const auth = checkAdminAuth(req);
      if (!auth.ok) {
        // unauthenticated callers should not receive drafts; enforce published=true
        where.published = true;
      }
    }
  }
  // Note: some Prisma connectors do not support the `mode` option on equals.
  // Use direct equality to avoid runtime validation errors.
  if (category && category !== 'All') where.category = category;
  if (subcategory && subcategory !== 'All') where.subcategory = subcategory;
  if (typeof featuredOnly !== 'undefined') {
    // accept '1'/'0', 'true'/'false'
    if (featuredOnly === '1' || featuredOnly === 'true') where.featuredOnly = true;
    else if (featuredOnly === '0' || featuredOnly === 'false') where.featuredOnly = false;
  }
    if (typeof pinned !== 'undefined') {
      // accept 'true'/'false' (string) from query params
      if (pinned === 'true' || pinned === 'false') where.pinned = pinned === 'true';
      else if (pinned === '1' || pinned === '0') where.pinned = pinned === '1';
    }
    // Exclude a specific article id from results (useful when listing related/latest items)
    if (typeof excludeId !== 'undefined') {
      const idNum = parseInt(String(excludeId), 10);
      if (!Number.isNaN(idNum)) where.id = { not: idNum };
    }
    // support excludeIds=1,2,3 (comma-separated list)
    if (typeof excludeIds !== 'undefined' && String(excludeIds).trim()){
      const parts = String(excludeIds).split(/[,\s]+/).map(s=>parseInt(s,10)).filter(n=>!Number.isNaN(n))
      if(parts.length) where.excludeIds = parts
    }
    if (q) {
      // Use simple contains search; some Prisma connectors do not support the `mode` option.
      where.OR = [
        { title: { contains: q } },
        { excerpt: { contains: q } },
      ];
    }
    const p = Math.max(1, Number(page) || 1);
    const ps = Math.max(1, Number(pageSize) || 20);
    // allow callers to explicitly request Opinions (admin UI)
  const includeOpinions = String(req.query.includeOpinions || '').toLowerCase() === '1' || String(req.query.includeOpinions || '').toLowerCase() === 'true';
  // New opt-in flag: include Guides table results when using Supabase. By default Guides are excluded
  // from general listings unless category explicitly requests them or includeGuides is true.
  const includeGuides = String(req.query.includeGuides || '').toLowerCase() === '1' || String(req.query.includeGuides || '').toLowerCase() === 'true';
    // Respect _debug flag to enable server-side logging for troubleshooting
    const debugFlag = String(req.query._debug || '').toLowerCase() === '1' || String(req.query._debug || '').toLowerCase() === 'true';
    const useSupabase = String(req.query.useSupabase || '').toLowerCase() === '1' || String(req.query.useSupabase || '').toLowerCase() === 'true';
  if (debugFlag) console.debug('[api/articles] GET debug enabled — where:', JSON.stringify(where), 'opts:', { includeOpinions, includeGuides, page: p, pageSize: ps, useSupabase });
    const sortOpt = sort === 'oldest' ? 'oldest' : 'recent'
    // If a text query is provided and Supabase is available, prefer the full-text RPC search for ranked results
    const levelFilter = req.query.level || req.query.tag || null;
    function _matchesLevel(item, level) {
      if (!level) return true;
      const target = String(level).trim().toLowerCase();
      const raw = item && (item.tags || item.tag || item.tags_list || item.tagsString || item.labels || null);
      if (!raw) return false;
      let arr = [];
      if (Array.isArray(raw)) arr = raw.map(t => String(t || '').trim().toLowerCase());
      else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
          try { const parsed = JSON.parse(trimmed); if (Array.isArray(parsed)) arr = parsed.map(t => String(t || '').trim().toLowerCase()); } catch (e) {}
        }
        if (!arr.length) arr = trimmed.split(',').map(t => String(t || '').trim().toLowerCase());
      } else arr = [String(raw).trim().toLowerCase()];
      return arr.includes(target);
    }

    function _looksAdvancedLike(item) {
      try {
        const probe = String((item && (item.subcategory || item.kicker || item.excerpt || item.description || item.title || item.slug)) || '').toLowerCase();
        return probe.indexOf('advanced') !== -1;
      } catch (e) { return false; }
    }
    function _looksIntermediateLike(item) {
      try {
        const probe = String((item && (item.subcategory || item.kicker || item.excerpt || item.description || item.title || item.slug)) || '').toLowerCase();
        return probe.indexOf('intermediate') !== -1 || probe.indexOf('level up') !== -1 || probe.indexOf('level: intermediate') !== -1;
      } catch (e) { return false; }
    }

    // Helper: stable sort items by publishedAt (fallback to createdAt then id) according to sortOpt
    function sortByDate(items, sortOpt) {
      if (!Array.isArray(items)) return items || [];
      const dir = sortOpt === 'oldest' ? 1 : -1; // oldest => ascending (1), recent => descending (-1)
      function getTs(item) {
        if (!item) return 0;
        // Prefer publishedAt, then updatedAt, then createdAt. Accept multiple field name variants.
        const tsField = item.publishedAt || item.published_at || item.published_at_iso || item.updatedAt || item.updated_at || item.createdAt || item.created_at || null;
        if (!tsField) return 0;
        try { return new Date(tsField).getTime() || 0; } catch (e) { return 0; }
      }
      return items.slice().sort((a, b) => {
        const aTs = getTs(a);
        const bTs = getTs(b);
        if (aTs === bTs) {
          const ai = a && a.id ? Number(a.id) : 0;
          const bi = b && b.id ? Number(b.id) : 0;
          return (ai - bi) * dir;
        }
        return (aTs - bTs) * dir;
      });
    }

    if (q && (process.env.SUPABASE_URL && (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))) {
      try {
        const { createClient } = require('@supabase/supabase-js')
        const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
        // Fetch enough rows for pagination (page * pageSize) then slice for the requested page
        // Prefer the new RPC that returns rows + total when available
        try {
          const off = (p - 1) * ps
          const rpcRes = await supa.rpc('search_articles_with_count', { q: String(q), lim: Number(ps), off: Number(off) })
          if (rpcRes && !rpcRes.error && rpcRes.data) {
            // rpcRes.data may be a JSON object (string); parse defensively
            const payload = typeof rpcRes.data === 'string' ? JSON.parse(rpcRes.data) : rpcRes.data
            const items = (payload.rows || [])
            // ensure ordering by requested sort option
            const orderedItems = sortByDate(items, sortOpt)
            let filteredItems = levelFilter ? orderedItems.filter(it => _matchesLevel(it, levelFilter)) : orderedItems
            // strict Beginner exclusion: remove any item that is tagged Advanced/Intermediate or hints at those levels
            if (levelFilter && String(levelFilter).trim().toLowerCase() === 'beginner') {
              const before = filteredItems.length;
              filteredItems = filteredItems.filter(it => !(_matchesLevel(it, 'advanced') || _matchesLevel(it, 'intermediate') || _looksAdvancedLike(it) || _looksIntermediateLike(it)));
              if (debugFlag) console.debug('[api/articles] beginner strict filter applied: before=', before, 'after=', filteredItems.length);
            }
            const total = Number(payload.total || filteredItems.length)
            const outItems = debugFlag ? (filteredItems || []).map(it => ({ ...normalizeArticle(it), _raw: { published_at: it.published_at || it.publishedAt || null, updated_at: it.updated_at || it.updatedAt || null, created_at: it.created_at || it.createdAt || null } })) : normalizeList(filteredItems)
            return res.json({ data: outItems, total, page: p, pageSize: ps })
          }
        } catch (rpcErr) {
          console.debug('[api/articles] search_articles_with_count RPC not available or failed:', rpcErr && rpcErr.message)
        }
        // Fallback: use contains-based search via db helpers (less relevant but functional)
        where.OR = [ { title: { contains: q } }, { excerpt: { contains: q } } ];
  const off = (p - 1) * ps;
  const [total, items] = await Promise.all([
      db.countArticles(where, { includeOpinions, includeGuides, _debug: debugFlag, forceSupabase: useSupabase }),
      db.findArticles({ where, take: ps, skip: off, includeOpinions, includeGuides, _debug: debugFlag, forceSupabase: useSupabase, sort: sortOpt }),
    ]);
  // apply optional level/tag filtering in-memory to cover mixed-table shapes, then order
  const itemsOrdered = sortByDate(Array.isArray(items) ? items : [], sortOpt);
  let finalItems = levelFilter ? (itemsOrdered ? itemsOrdered.filter(it => _matchesLevel(it, levelFilter)) : []) : itemsOrdered;
  if (debugFlag) finalItems = (finalItems || []).map(it => ({ ...normalizeArticle(it), _raw: { published_at: it.published_at || it.publishedAt || null, updated_at: it.updated_at || it.updatedAt || null, created_at: it.created_at || it.createdAt || null } }));
  // strict Beginner exclusion for the no-q path as well
  if (levelFilter && String(levelFilter).trim().toLowerCase() === 'beginner') {
    const before = Array.isArray(finalItems) ? finalItems.length : 0;
    finalItems = (Array.isArray(finalItems) ? finalItems.filter(it => !(_matchesLevel(it, 'advanced') || _matchesLevel(it, 'intermediate') || _looksAdvancedLike(it) || _looksIntermediateLike(it))) : []);
    if (debugFlag) console.debug('[api/articles] beginner strict filter (no-q): before=', before, 'after=', (finalItems && finalItems.length));
  }
  const finalTotal = levelFilter ? (finalItems.length) : total;
  return res.json({ data: debugFlag ? finalItems : normalizeList(finalItems), total: finalTotal, page: p, pageSize: ps });
      } catch (e) {
        console.error('[api/articles] supabase suggest branch error', e && e.message)
        // Fall through to default behavior below
      }
    }

    const off = (p - 1) * ps;
    const [total, items] = await Promise.all([
        db.countArticles(where, { includeOpinions, includeGuides, _debug: debugFlag, forceSupabase: useSupabase }),
        db.findArticles({ where, take: ps, skip: off, includeOpinions, includeGuides, _debug: debugFlag, forceSupabase: useSupabase, sort: sortOpt }),
      ]);
  // apply optional level/tag filtering in-memory for requests without a text `q`, then order
  const itemsOrdered2 = sortByDate(Array.isArray(items) ? items : [], sortOpt);
  const finalItems = levelFilter ? (itemsOrdered2 ? itemsOrdered2.filter(it => _matchesLevel(it, levelFilter)) : []) : itemsOrdered2;
    // If a Beginner filter produced nothing, do not return Advanced items; keep finalItems empty so client shows placeholders
    if (levelFilter && String(levelFilter).trim().toLowerCase() === 'beginner' && Array.isArray(items) && finalItems.length === 0) {
      if (debugFlag) console.debug('[api/articles] beginner filter produced no strict matches; returning empty data set to avoid showing Advanced items');
      return res.json({ data: [], total: 0, page: p, pageSize: ps });
    }
  const finalTotal = levelFilter ? (finalItems.length) : total;
  return res.json({ data: normalizeList(finalItems), total: finalTotal, page: p, pageSize: ps });
  }

  if (req.method === 'POST') {
  if (!requireAdmin(req, res)) return;
  // DEBUG: log incoming body to help troubleshoot publish/draft mismatches
  try { console.debug && console.debug('API /api/articles POST body:', req.body); } catch (e) {}
  // Coerce published to a boolean in case the client sends strings or undefined
  const { title, category, excerpt, content, coverImage, author, thumbnail, subcategory, pinned, slug: incomingSlug, tags, ogTitle, ogDescription, ogImage, scheduledAt, coverAlt, thumbnailAlt, featuredOnly } = req.body;
  const published = !!req.body.published;
  // allow drafts without a title by defaulting to empty string; generate a safe draft slug
  const safeTitle = title || '';
  const pinnedBool = !!pinned;
  // server-side validation for required fields
  // Only validate required fields when creating a published article. Drafts may omit these.
  if (published) {
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'title required' });
    if (!excerpt || !String(excerpt).trim()) return res.status(400).json({ error: 'excerpt required' });
    if (!category || !String(category).trim()) return res.status(400).json({ error: 'category required' });
    if (!author || !String(author).trim()) return res.status(400).json({ error: 'author required' });
    if (!tags || !Array.isArray(tags) || tags.length === 0) return res.status(400).json({ error: 'at least one tag required' });
    if (!coverImage || !String(coverImage).trim()) return res.status(400).json({ error: 'coverImage required' });
    if (!thumbnail || !String(thumbnail).trim()) return res.status(400).json({ error: 'thumbnail required' });
    if (!content || !String(content).replace(/<[^>]*>/g,'').trim()) return res.status(400).json({ error: 'content required' });
  }
    // Always prefer a slug derived from the title when a title is present.
    const generated = safeTitle ? slugifyTitle(safeTitle, 60) : null;
        const slug = generated || incomingSlug || `draft-${Date.now()}`;
      const publishedAt = published ? new Date() : null;
      const safeContent = sanitizeHtml(content || '');
    try {
      // Compute canonical URL according to category rules so DB records include the canonical location.
      const siteUrl = process.env.SITE_URL || 'https://cointist.net';
      const cat = String(category || '').trim();
      const catLower = cat.toLowerCase();
      let canonical = null;
      if (catLower === 'guides') canonical = `${siteUrl}/guides/${slug}`;
      else canonical = `${siteUrl}/${encodeURIComponent(catLower)}/articles/${encodeURIComponent(slug)}`;

      const created = await db.createArticle({ title: safeTitle, slug, category, canonical, excerpt, content: safeContent, published, publishedAt, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, coverImage, thumbnail, subcategory, pinned: pinnedBool, pinnedAt: pinnedBool ? new Date() : null, author, tags: tags ? tags : null, ogTitle: ogTitle || null, ogDescription: ogDescription || null, ogImage: ogImage || null, featuredOnly: !!featuredOnly });
        // create initial version
        try { await db.createArticleVersion({ articleId: created.id, title: created.title, excerpt: created.excerpt || null, content: created.content || '', data: { created } }); } catch(e){}
        return res.status(201).json(created);
      } catch (e) {
        // If Prisma schema mismatch causes scheduledAt field error, retry without scheduledAt
        if (String(e.message || '').toLowerCase().includes('scheduledat') || String(e.message || '').toLowerCase().includes('unknown argument') ) {
          try {
            const created = await prisma.article.create({ data: { title: safeTitle, slug, category, excerpt, content: safeContent, published, publishedAt, coverImage, thumbnail, subcategory, pinned: pinnedBool, pinnedAt: pinnedBool ? new Date() : null, author, tags: tags ? tags : null, ogTitle: ogTitle || null, ogDescription: ogDescription || null, ogImage: ogImage || null } });
            try { await prisma.articleVersion.create({ data: { articleId: created.id, title: created.title, excerpt: created.excerpt || null, content: created.content || '', data: { created } } }); } catch(e){}
            return res.status(201).json(created);
          } catch (e2) { return res.status(500).json({ error: e2.message }); }
        }
        return res.status(500).json({ error: e.message });
      }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

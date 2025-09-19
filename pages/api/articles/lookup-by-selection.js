import { createClient } from '@supabase/supabase-js'
import prisma from '../../../src/lib/prisma'
import db from '../../../src/lib/db'

function normalizeArticle(row = {}) {
  try {
    const publishedAt = row.publishedAt || row.published_at || row.published_at_iso || null
    const publishedRaw = typeof row.published !== 'undefined' ? row.published : (typeof row.is_published !== 'undefined' ? row.is_published : (typeof row.published_flag !== 'undefined' ? row.published_flag : null))
    const published = (publishedRaw !== null && typeof publishedRaw !== 'undefined') ? !!publishedRaw : !!publishedAt
    return { ...row, published, publishedAt: publishedAt || null }
  } catch (e) { return { ...row, published: false, publishedAt: null } }
}

export default async function handler(req, res) {
  const sid = String(req.query.sid || '').trim()
  const debugMode = String(req.query._debug || '').toLowerCase() === '1' || String(req.query._debug || '').toLowerCase() === 'true'
  if (!sid) return res.status(400).json({ error: 'sid required' })

  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  // Try Supabase first (most reliable for production)
  if (SUPA_URL && SUPA_KEY) {
    try {
      const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
      // Search Article table by selectionId, originalId, or sourceId
      const orExpr = `selectionId.eq.${sid},originalId.eq.${sid},sourceId.eq.${sid}`
      const { data, error } = await supa.from('Article').select('id,slug,title,excerpt,thumbnail,coverImage,published,publishedAt').or(orExpr).limit(1)
      if (!error && Array.isArray(data) && data.length) {
        const norm = normalizeArticle(data[0])
        return res.json(norm)
      }
    } catch (e) {
      // continue to prisma fallback
      try { console.debug('[lookup-by-selection] supabase error', e && e.message) } catch (_) {}
    }
  }

  // Prisma/db fallback (may not have all columns depending on schema)
  try {
    if (db && db.findArticleByMeta) {
      const found = await db.findArticleByMeta({ selectionId: sid, originalId: sid, sourceId: sid })
      if (found) return res.json(normalizeArticle(found))
    }
  } catch (e) {
    // ignore and try direct prisma
  }
  try {
    // Try a sequence of queries to avoid validation errors if some fields don't exist
    let found = null
    try { found = await prisma.article.findFirst({ where: { selectionId: sid } }) } catch (_) {}
    if (!found) { try { found = await prisma.article.findFirst({ where: { originalId: sid } }) } catch (_) {} }
    if (!found) { try { found = await prisma.article.findFirst({ where: { sourceId: sid } }) } catch (_) {} }
    if (found) return res.json(normalizeArticle(found))
  } catch (e) {
    // ignore
  }

  return res.status(404).json({ error: 'Not found' })
}

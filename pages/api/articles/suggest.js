import { createClient } from '@supabase/supabase-js'

// Lightweight suggestion endpoint: returns id, title, slug, thumbnail for matches in Article and Guides
export default async function handler(req, res) {
  const q = String(req.query.q || '').trim()
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 8))
  const debugMode = String(req.query._debug || '').toLowerCase() === '1' || String(req.query._debug || '').toLowerCase() === 'true'
  if (!q) return res.json({ data: [] })

  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  if (SUPA_URL && SUPA_KEY) {
    try {
      const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
      // Prefer a Postgres full-text search RPC named `search_articles` if present — this will use an indexed tsvector
      try {
        const rpcRes = await supa.rpc('search_articles', { q, lim: limit })
        if (rpcRes && !rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length) {
          if (debugMode) return res.json({ data: rpcRes.data })
          return res.json({ data: rpcRes.data.map(r=>({ id: r.id, title: r.title, slug: r.slug, thumbnail: r.thumbnail })) })
        }
      } catch (rpcErr) {
        // RPC may not exist in the DB; fall back to ilike below
        console.debug('[api/articles/suggest] search_articles RPC not available or failed:', rpcErr && rpcErr.message)
      }

      // Fallback: Use ilike for case-insensitive partial match on title OR excerpt
      const qpattern = `%${q.replace(/%/g,'\\%')}%`
      const [aRes, gRes] = await Promise.all([
        supa.from('Article').select('id,title,slug,thumbnail,publishedAt').ilike('title', qpattern).or(`excerpt.ilike.${qpattern}`).limit(limit),
        supa.from('Guides').select('id,title,slug,thumbnail,publishedAt').ilike('title', qpattern).or(`excerpt.ilike.${qpattern}`).limit(limit),
      ])
      const aData = (aRes && aRes.data) || []
      const gData = (gRes && gRes.data) || []
      let results = [...aData, ...gData]
      if (debugMode) return res.json({ data: results })
      results = results.sort((x,y)=>{
        const dx = x && x.publishedAt ? new Date(x.publishedAt).getTime() : 0
        const dy = y && y.publishedAt ? new Date(y.publishedAt).getTime() : 0
        return dy - dx
      }).slice(0, limit)
      return res.json({ data: results.map(r=>({ id: r.id, title: r.title, slug: r.slug, thumbnail: r.thumbnail })) })
    } catch (e) {
      console.error('[api/articles/suggest] supabase error', e && e.message)
    }
  }

  // Fallback: try Prisma directly
  try {
    // eslint-disable-next-line global-require
    const prisma = require('../../../src/lib/prisma').default || require('../../../src/lib/prisma')
    const where = {
      OR: [ { title: { contains: q } }, { excerpt: { contains: q } } ]
    }
  const items = await prisma.article.findMany({ where, orderBy: { publishedAt: 'desc' }, take: limit })
  if (debugMode) return res.json({ data: items })
  return res.json({ data: items.map(r=>({ id: r.id, title: r.title, slug: r.slug, thumbnail: r.thumbnail })) })
  } catch (e) {
    console.error('[api/articles/suggest] prisma fallback error', e && e.message)
  }

  // final fallback: empty
  return res.json({ data: [] })
}

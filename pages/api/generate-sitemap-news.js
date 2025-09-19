// POST/GET /api/generate-sitemap-news
// Protect with a secret header: 'x-sitemap-secret' matching process.env.SITEMAP_CRON_SECRET
// This endpoint generates the same XML as /sitemap-news.xml and uploads it to GCS
import { promises as fs } from 'fs'

export default async function handler(req, res) {
  try {
    const secret = req.headers['x-sitemap-secret'] || req.query.secret
    if (!secret || secret !== process.env.SITEMAP_CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { findArticles } = require('../../src/lib/db')
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
    const raw = await findArticles({ where: { category: 'News', published: true, publishedAt: { gte: twoDaysAgo } }, sort: 'recent', take: 1000 })
    const list = Array.isArray(raw) ? raw : (raw && raw.data ? raw.data : [])
    const cutoffDate = new Date(Date.now() - (48 * 60 * 60 * 1000))
    const urls = list.map(it => {
      const slug = it && it.slug ? it.slug : (it && it.id ? String(it.id) : null)
      const href = slug ? `${siteUrl}/articles/${slug}` : null
      const pub = it && (it.publishedAt || it.published_at || it.createdAt || it.created_at) ? new Date(it.publishedAt || it.published_at || it.createdAt || it.created_at).toISOString() : null
      const title = it && it.title ? it.title : ''
      const keywords = it && it.tags ? (Array.isArray(it.tags) ? it.tags.join(', ') : String(it.tags)) : ''
      return { href, pub, title, keywords }
    }).filter(u => u && u.href && u.pub).filter(u => {
      const d = new Date(u.pub)
      if (isNaN(d.getTime())) return false
      return d >= cutoffDate
    }).slice(0,1000)

    const xmlParts = []
    xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
    xmlParts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">')
    for (const u of urls) {
      xmlParts.push('  <url>')
      xmlParts.push(`    <loc>${u.href}</loc>`)
      xmlParts.push('    <news:news>')
      xmlParts.push('      <news:publication>')
      xmlParts.push('        <news:name>Cointist</news:name>')
      xmlParts.push('        <news:language>en</news:language>')
      xmlParts.push('      </news:publication>')
      xmlParts.push(`      <news:publication_date>${u.pub}</news:publication_date>`)
      xmlParts.push(`      <news:title>${escapeXml(u.title)}</news:title>`)
      if (u.keywords) xmlParts.push(`      <news:keywords>${escapeXml(u.keywords)}</news:keywords>`)
      xmlParts.push('    </news:news>')
      xmlParts.push(`    <lastmod>${u.pub}</lastmod>`)
      xmlParts.push('  </url>')
    }
    xmlParts.push('</urlset>')
    const xml = xmlParts.join('\n')

    // Upload to GCS if credentials provided; otherwise write to /public for local testing
    const bucketName = process.env.GCS_BUCKET
    const serviceKey = process.env.GCS_SERVICE_ACCOUNT_KEY
    if (bucketName && serviceKey) {
      let ok = false
      try {
        const { Storage } = require('@google-cloud/storage')
        const storage = new Storage({ credentials: JSON.parse(serviceKey) })
        const bucket = storage.bucket(bucketName)
        const file = bucket.file('sitemap-news.xml')
        await file.save(xml, { contentType: 'application/xml', resumable: false, metadata: { cacheControl: 'public, max-age=600' } })
        try { await file.makePublic() } catch(e) { /* ignore permission errors */ }
        ok = true
        const publicUrl = `https://storage.googleapis.com/${bucketName}/sitemap-news.xml`
        return res.status(200).json({ ok: true, url: publicUrl })
      } catch (e) {
        console.error('GCS upload failed', e)
        // fall through to local write
      }
    }

    // Local fallback (useful during development)
    try{
      await fs.mkdir('public', { recursive: true })
      await fs.writeFile('public/sitemap-news.xml', xml, 'utf8')
      return res.status(200).json({ ok: true, url: '/sitemap-news.xml' })
    }catch(e){
      console.error('Local write failed', e)
      return res.status(500).json({ ok: false, error: 'Failed to write sitemap' })
    }
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Internal error' })
  }
}

function escapeXml(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;') }

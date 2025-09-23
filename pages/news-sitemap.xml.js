// pages/news-sitemap.xml.js
// Server-side route: generates a Google News sitemap XML on-demand (no file writes).
import { parse } from 'url'

export async function getServerSideProps({ res, req }){
  try{
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    // prefer Supabase direct query for predictable behavior in server environments
    let list = []
    try{
      const { createClient } = await import('@supabase/supabase-js')
      const SUPA_URL = process.env.SUPABASE_URL
      const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      if (SUPA_URL && SUPA_KEY) {
        const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
  const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
  // Fetch recent articles without forcing publishedAt presence; filter in JS using fallback dates
  const { data, error } = await supa.from('Article').select('*').eq('category', 'News').order('publishedAt', { ascending: false }).limit(1000)
        if (!error && Array.isArray(data)) list = data
      }
    }catch(e){
      // fallback: try to import app db helper (works in Node env if module supports require/import)
      try{
        const mod = await import('../src/lib/db.js')
        const findArticles = mod.findArticles || (mod.default && mod.default.findArticles)
        if (findArticles) {
          const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
          list = await findArticles({ where: { category: 'News', published: true, publishedAt: { gte: twoDaysAgo } }, sort: 'recent', take: 1000 })
        }
      }catch(e2){ /* ignore */ }
    }

    const cutoffDate = new Date(Date.now() - (48 * 60 * 60 * 1000))
    const urls = (Array.isArray(list) ? list : []).map(it => {
      const slug = it && it.slug ? it.slug : (it && it.id ? String(it.id) : null)
      const href = slug ? `${siteUrl}/articles/${slug}` : null
      // For Google News, use the original creation date as the publication_date
      // (do not use updatedAt to avoid making updated articles appear as newly published)
      const rawDate = it && (it.createdAt || it.created_at) ? (it.createdAt || it.created_at) : null
      const pub = rawDate ? new Date(rawDate).toISOString() : null
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

    // set headers and return raw XML
    res.setHeader('Content-Type', 'application/xml')
  // Cache for 6 hours; publishers should call webhook on publish to purge/regen if needed
  res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=59')
    res.write(xml)
    res.end()
    return { props: {} }
  }catch(e){
    console.error('news-sitemap generation error', e)
    res.statusCode = 500
    res.setHeader('Content-Type','text/plain')
    res.end('Internal error')
    return { props: {} }
  }
}

export default function Sitemap() { return null }

function escapeXml(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;') }

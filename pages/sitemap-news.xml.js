// Dynamic news sitemap for Google News
// Serves up to 1000 recent NewsArticle URLs (48h window)
export async function getServerSideProps({ res }){
  try{
    const { findArticles } = require('../src/lib/db')
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    // find recent news articles (last 2 days)
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
    }).filter(Boolean).filter(u => {
      if (!u || !u.pub) return false
      const d = new Date(u.pub)
      if (isNaN(d.getTime())) return false
      return d >= cutoffDate
    }).slice(0,1000)

    res.setHeader('Content-Type','application/xml')
    const xmlParts = []
    xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
    xmlParts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">')
    for (const u of urls){
      if (!u.href || !u.pub) continue
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
    res.write(xmlParts.join('\n'))
    res.end()
    return { props: {} }
  }catch(e){
    // graceful fallback: return a minimal empty sitemap
    res.setHeader('Content-Type','application/xml')
    res.write('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')
    res.end()
    return { props: {} }
  }
}

function escapeXml(s){
  if (!s) return ''
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')
}

export default function Sitemap() { return null }

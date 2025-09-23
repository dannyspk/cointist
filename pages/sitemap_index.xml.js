// pages/sitemap_index.xml.js
// Dynamic sitemap index: returns sitemap index XML with up-to-date lastmod values.
import fs from 'fs/promises'
import path from 'path'

async function gcsLastMod(bucketName, objectName){
  try{
    const { Storage } = await import('@google-cloud/storage')
    const serviceKey = process.env.GCS_SERVICE_ACCOUNT_KEY
    const storage = new Storage({ credentials: serviceKey ? JSON.parse(serviceKey) : undefined })
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(objectName)
    const [meta] = await file.getMetadata()
    if (meta && meta.updated) return new Date(meta.updated).toISOString()
  }catch(e){ /* ignore */ }
  return null
}

export async function getServerSideProps({ res }){
  try{
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    const entries = []

    // sitemap.xml (static) - try local file first, then GCS
    const localSitemap = path.join(process.cwd(), 'public', 'sitemap.xml')
    let sitemapLast = null
    try{
      const st = await fs.stat(localSitemap)
      sitemapLast = st.mtime.toISOString()
    }catch(e){
      // try GCS
      const bucket = process.env.GCS_BUCKET
      if (bucket) sitemapLast = await gcsLastMod(bucket, 'sitemap.xml')
    }
    entries.push({ loc: `${siteUrl}/sitemap.xml`, lastmod: sitemapLast })

    // news sitemap (dynamic) - use current time as lastmod (reflects live generation)
    const nowIso = new Date().toISOString()
    entries.push({ loc: `${siteUrl}/news-sitemap.xml`, lastmod: nowIso })

    const parts = []
    parts.push('<?xml version="1.0" encoding="UTF-8"?>')
    parts.push('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for (const e of entries){
      parts.push('  <sitemap>')
      parts.push(`    <loc>${e.loc}</loc>`)
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`)
      parts.push('  </sitemap>')
    }
    parts.push('</sitemapindex>')
    const xml = parts.join('\n')

    res.setHeader('Content-Type', 'application/xml')
    // cache for 6 hours to match news sitemap TTL
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=59')
    res.write(xml)
    res.end()
    return { props: {} }
  }catch(e){
    console.error('sitemap_index generation error', e)
    res.statusCode = 500
    res.setHeader('Content-Type','text/plain')
    res.end('Internal error')
    return { props: {} }
  }
}

export default function SitemapIndex(){ return null }

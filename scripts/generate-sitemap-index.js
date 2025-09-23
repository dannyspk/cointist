#!/usr/bin/env node
// scripts/generate-sitemap-index.js
// Generates public/sitemap_index.xml referencing sitemap.xml and sitemap-news.xml with lastmod entries.
const fs = require('fs').promises
const path = require('path')
async function fileLastModLocal(filePath){
  try{
    const stat = await fs.stat(filePath)
    return stat.mtime.toISOString()
  }catch(e){ return null }
}
async function fileLastModGcs(bucketName, objectName){
  try{
    const { Storage } = require('@google-cloud/storage')
    const serviceKey = process.env.GCS_SERVICE_ACCOUNT_KEY
    const storage = new Storage({ credentials: serviceKey ? JSON.parse(serviceKey) : undefined })
    const bucket = storage.bucket(bucketName)
    const file = bucket.file(objectName)
    const [meta] = await file.getMetadata()
    if (meta && meta.updated) return new Date(meta.updated).toISOString()
  }catch(e){ /* ignore */ }
  return null
}
async function resolveLastMod(filename){
  const local = path.join(process.cwd(), 'public', filename)
  const lmLocal = await fileLastModLocal(local)
  if (lmLocal) return lmLocal
  // fallback to GCS if configured
  const bucket = process.env.GCS_BUCKET
  if (bucket) {
    return await fileLastModGcs(bucket, filename)
  }
  return null
}

async function main(){
  try{
    const sitemaps = ['sitemap.xml']
    const urls = []
    for (const f of sitemaps){
      const lastmod = await resolveLastMod(f)
      const siteUrl = process.env.SITE_URL || 'https://cointist.net'
      const loc = `${siteUrl}/${f}`
      urls.push({ loc, lastmod })
    }

    // Add dynamic news sitemap (served at /news-sitemap.xml). Use current time as lastmod
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    const nowIso = new Date().toISOString()
    urls.push({ loc: `${siteUrl}/news-sitemap.xml`, lastmod: nowIso })

    const parts = []
    parts.push('<?xml version="1.0" encoding="UTF-8"?>')
    parts.push('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for (const u of urls){
      parts.push('  <sitemap>')
      parts.push(`    <loc>${u.loc}</loc>`)
      if (u.lastmod) parts.push(`    <lastmod>${u.lastmod}</lastmod>`)
      parts.push('  </sitemap>')
    }
    parts.push('</sitemapindex>')
    const xml = parts.join('\n')
    await fs.mkdir('public', { recursive: true })
    await fs.writeFile('public/sitemap_index.xml', xml, 'utf8')
    console.log('sitemap_index.xml written to public/sitemap_index.xml')
  }catch(e){
    console.error('generate-sitemap-index failed', e)
    process.exitCode = 1
  }
}

main()

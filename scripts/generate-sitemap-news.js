#!/usr/bin/env node
// scripts/generate-sitemap-news.js
// Run during build to generate public/sitemap-news.xml locally.
const fs = require('fs').promises
async function main(){
  try{
    // Query Supabase directly to avoid importing app DB helpers (works during build)
    const { createClient } = require('@supabase/supabase-js')
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if (!SUPA_URL || !SUPA_KEY) throw new Error('Missing SUPABASE_URL or SUPABASE key in env; cannot query articles')
    const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
    const siteUrl = process.env.SITE_URL || 'https://cointist.net'
    const twoDaysAgo = new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString()
    const { data: listData, error } = await supa.from('Article').select('*').gte('publishedAt', twoDaysAgo).eq('category', 'News').order('publishedAt', { ascending: false }).limit(1000)
    if (error) throw error
    const list = Array.isArray(listData) ? listData : []
    const cutoffDate = new Date(Date.now() - (48 * 60 * 60 * 1000))
    // Build initial candidate list
    const candidates = list.map(it => {
      const slug = it && it.slug ? it.slug : (it && it.id ? String(it.id) : null)
  // Prefer the news canonical base for article URLs
  const href = slug ? `${siteUrl}/news/articles/${slug}` : null
      // Use creation date only for news publication_date (avoid updatedAt)
      const pub = it && (it.createdAt || it.created_at) ? new Date(it.createdAt || it.created_at).toISOString() : null
      const title = it && it.title ? it.title : ''
      const keywords = it && it.tags ? (Array.isArray(it.tags) ? it.tags.join(', ') : String(it.tags)) : ''
      return { href, pub, title, keywords }
    }).filter(u => u && u.href && u.pub).filter(u => {
      const d = new Date(u.pub)
      if (isNaN(d.getTime())) return false
      return d >= cutoffDate
    }).slice(0,1000)

    // Resolve redirects for each candidate and use final canonical URL.
    // For internal site links (same host as SITE_URL) prefer the constructed
    // `/news/articles/<slug>` path and skip redirect resolution to avoid
    // following app-level rewrites that point at `/articles/<slug>`.
    const resolved = []
    const siteHost = (() => { try { return new URL(siteUrl).host } catch(e){ return null } })()
    for (const c of candidates) {
      try{
        let final = c.href
        // Only perform HEAD redirect resolution for external hosts
        if (siteHost) {
          const parsed = new URL(c.href)
          if (parsed.host !== siteHost) {
            final = await resolveFinalUrl(c.href) || c.href
          }
        } else {
          final = await resolveFinalUrl(c.href) || c.href
        }
        resolved.push({ href: final || c.href, pub: c.pub, title: c.title, keywords: c.keywords })
      }catch(e){
        // If resolution fails, fall back to original href
        resolved.push(c)
      }
    }
    // Deduplicate final URLs: merge entries that resolve to the same canonical href
    const dedupMap = new Map()
    for (const r of resolved) {
      const key = r.href
      if (!dedupMap.has(key)) {
        dedupMap.set(key, { href: r.href, pub: r.pub, title: r.title, keywords: r.keywords })
      } else {
        const existing = dedupMap.get(key)
        // prefer the earliest pub date as the canonical publication_date
        try{
          const e = existing.pub ? new Date(existing.pub) : null
          const n = r.pub ? new Date(r.pub) : null
          if (n && e) {
            if (n.getTime() < e.getTime()) existing.pub = r.pub
          } else if (n && !e) existing.pub = r.pub
        }catch(e){ /* ignore date parse errors */ }
        // merge keywords de-duplicated
        const parts = []
        if (existing.keywords) parts.push(...String(existing.keywords).split(/\s*,\s*/).filter(Boolean))
        if (r.keywords) parts.push(...String(r.keywords).split(/\s*,\s*/).filter(Boolean))
        const uniq = Array.from(new Set(parts.map(s=>s.toLowerCase()))).map(s=>s.trim()).filter(Boolean)
        existing.keywords = uniq.join(', ')
        // prefer an existing title if present; otherwise take new
        if (!existing.title && r.title) existing.title = r.title
        dedupMap.set(key, existing)
      }
    }
    const urls = Array.from(dedupMap.values()).slice(0,1000)

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

    await fs.mkdir('public', { recursive: true })
    await fs.writeFile('public/sitemap-news.xml', xml, 'utf8')
    console.log('sitemap-news.xml written to public/sitemap-news.xml')
  }catch(e){
    console.error('generate-sitemap-news failed', e)
    process.exitCode = 1
  }
}

function escapeXml(s){ if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;') }

// Follow redirects (HEAD requests) up to a max hops and return final location
function resolveFinalUrl(u, maxHops = 5){
  return new Promise((resolve, reject) => {
    try{
      const parsed = new URL(u)
      const lib = parsed.protocol === 'https:' ? require('https') : require('http')
      let hops = 0
      function doReq(urlToCheck){
        const req = lib.request(urlToCheck, { method: 'HEAD', timeout: 10000 }, (res) => {
          const status = res.statusCode || 0
          if (status >= 300 && status < 400 && res.headers && res.headers.location && hops < maxHops) {
            hops++
            // Resolve relative Location headers
            try{
              const next = new URL(res.headers.location, urlToCheck).toString()
              doReq(next)
            }catch(e){ resolve(urlToCheck) }
          } else {
            resolve(urlToCheck)
          }
        })
        req.on('error', (e)=>{ reject(e) })
        req.on('timeout', ()=>{ req.destroy(); resolve(u) })
        req.end()
      }
      doReq(u)
    }catch(e){ reject(e) }
  })
}

main()

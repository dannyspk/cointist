const crypto = require('crypto')

// Require scripts (they may be CommonJS)
const generateStaticSitemap = require('../../scripts/generate-static-sitemap.js')
const pingGoogle = require('../../scripts/ping-google-sitemap.js')

async function verifySecret(req) {
  const provided = req.headers['x-publish-secret'] || req.query.secret
  const expected = process.env.PUBLISH_HOOK_SECRET
  if (!expected) return false
  const a = Buffer.from(String(provided || ''))
  const b = Buffer.from(String(expected))
  try {
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch (e) {
    return false
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' })
  }

  const ok = await verifySecret(req)
  if (!ok) return res.status(401).json({ ok: false, message: 'Unauthorized' })

  try {
    // Regenerate static sitemap
    if (typeof generateStaticSitemap === 'function') {
      await generateStaticSitemap({ quiet: true })
    } else if (generateStaticSitemap && typeof generateStaticSitemap.main === 'function') {
      await generateStaticSitemap.main({ quiet: true })
    }

    // Warm the sitemap by fetching it once
    const siteUrl = (process.env.SITE_URL || 'https://cointist.net').replace(/\/$/, '')
    const sitemapUrl = siteUrl + '/sitemap.xml'
    await fetch(sitemapUrl, { method: 'GET', headers: { 'User-Agent': 'Cointist-Publish-Hook' } })

    // Ping Google with retries
    if (pingGoogle && typeof pingGoogle === 'function') {
      await pingGoogle(sitemapUrl)
    } else if (pingGoogle && typeof pingGoogle.ping === 'function') {
      await pingGoogle.ping(sitemapUrl)
    }

    return res.status(200).json({ ok: true, sitemap: sitemapUrl })
  } catch (err) {
    console.error('publish-hook error', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

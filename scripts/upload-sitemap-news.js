// Usage: node scripts/upload-sitemap-news.js
// Expects environment variables: SITEMAP_CRON_SECRET (required), SITEMAP_ENDPOINT (optional)
// Example: SITEMAP_CRON_SECRET=your-secret node scripts/upload-sitemap-news.js
const http = require('http')
const https = require('https')
const { URL } = require('url')

const secret = process.env.SITEMAP_CRON_SECRET
if (!secret) {
  console.error('Missing SITEMAP_CRON_SECRET env var')
  process.exit(2)
}

const DEFAULT_ENDPOINT = 'http://localhost:3000/api/generate-sitemap-news'
const endpoint = process.env.SITEMAP_ENDPOINT || DEFAULT_ENDPOINT
let url
try {
  url = new URL(endpoint)
} catch (e) {
  console.error('Invalid SITEMAP_ENDPOINT URL:', endpoint)
  process.exit(2)
}

const isHttps = url.protocol === 'https:'
const lib = isHttps ? https : http
const port = url.port ? Number(url.port) : (isHttps ? 443 : 80)
const method = process.env.SITEMAP_METHOD || 'POST'
const timeoutMs = Number(process.env.SITEMAP_TIMEOUT_MS || 15000)

const options = {
  hostname: url.hostname,
  port: port,
  path: url.pathname + (url.search || ''),
  method: method,
  headers: {
    'x-sitemap-secret': secret,
    'User-Agent': 'cointist-sitemap-uploader/1.0',
    'Accept': 'application/json'
  },
  timeout: timeoutMs,
}

const req = lib.request(options, (res) => {
  let body = ''
  res.on('data', (chunk) => body += chunk.toString())
  res.on('end', () => {
    console.log('Status:', res.statusCode)
    try {
      const parsed = JSON.parse(body)
      console.log('Response JSON:', JSON.stringify(parsed, null, 2))
    } catch (e) {
      console.log('Response body:', body)
    }
    if (res.statusCode >= 200 && res.statusCode < 300) process.exit(0)
    process.exit(1)
  })
})

req.on('timeout', () => {
  console.error('Request timed out after', timeoutMs, 'ms')
  req.destroy()
  process.exit(1)
})

req.on('error', (err) => {
  console.error('Request error:', err && err.message ? err.message : err)
  process.exit(1)
})

// No body required for this endpoint; send empty string
req.end('')

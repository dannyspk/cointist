const http = require('http')
const https = require('https')

const base = process.env.SITE_URL || 'https://cointist.net'
const paths = [
  '/news',
  '/opinion',
  '/reviews',
  '/rss',
  '/guides/bridge-s-interoperability',
  '/privacy',
  '/terms'
]

function headOnce(url){
  return new Promise((resolve)=>{
    try{
      const parsed = new URL(url)
      const lib = parsed.protocol === 'https:' ? https : http
      const req = lib.request(url, { method: 'HEAD', timeout: 10000 }, (res)=>{
        resolve({ url, status: res.statusCode, location: res.headers.location || null })
      })
      req.on('error', (e)=> resolve({ url, error: e.message }))
      req.on('timeout', ()=>{ req.destroy(); resolve({ url, error: 'timeout' }) })
      req.end()
    }catch(e){ resolve({ url, error: String(e && e.message) }) }
  })
}

function resolveFinalUrl(u, maxHops = 6){
  return new Promise((resolve)=>{
    try{
      let hops = 0
      function doReq(urlToCheck){
        const parsed = new URL(urlToCheck)
        const lib = parsed.protocol === 'https:' ? https : http
        const req = lib.request(urlToCheck, { method: 'HEAD', timeout: 10000 }, (res)=>{
          const status = res.statusCode || 0
          if (status >= 300 && status < 400 && res.headers && res.headers.location && hops < maxHops){
            hops++
            try{
              const next = new URL(res.headers.location, urlToCheck).toString()
              doReq(next)
            }catch(e){ resolve({ finalUrl: urlToCheck, status }) }
          } else {
            resolve({ finalUrl: urlToCheck, status })
          }
        })
        req.on('error', (e)=> resolve({ finalUrl: urlToCheck, error: e.message }))
        req.on('timeout', ()=>{ req.destroy(); resolve({ finalUrl: urlToCheck, error: 'timeout' }) })
        req.end()
      }
      doReq(u)
    }catch(e){ resolve({ finalUrl: u, error: String(e && e.message) }) }
  })
}

(async ()=>{
  for (const p of paths){
    const url = (p.startsWith('http') ? p : (base.replace(/\/$/, '') + p))
    const initial = await headOnce(url)
    const resolved = await resolveFinalUrl(url)
    console.log(JSON.stringify({ path: p, initial, resolved }))
  }
})()

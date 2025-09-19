const https = require('https');

function ping(sitemapUrl) {
  sitemapUrl = sitemapUrl || process.env.SITEMAP_URL || 'https://cointist.net/sitemap.xml';
  const url = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
  return new Promise((resolve, reject)=>{
    https.get(url, (res) => {
      const status = res.statusCode;
      res.on('data', ()=>{});
      res.on('end', ()=> resolve({ url, status }));
    }).on('error', (e)=>{
      reject(e);
    });
  });
}

module.exports = ping;

if (require.main === module) {
  ping().then(r=>{ console.log('Pinged Google:', r.url, '->', r.status); process.exit(0); }).catch(e=>{ console.error('Ping failed:', e.message); process.exit(2); });
}

const https = require('http');
const url = require('url');
const endpoint = process.argv[2] || 'http://localhost:3001/api/generate-sitemap-news?secret=local-temp-secret-123456';
(async ()=>{
  try {
    const u = new URL(endpoint);
    const lib = u.protocol === 'https:' ? require('https') : require('http');
    const opts = { method: 'GET' };
    const req = lib.request(u, opts, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => {
        console.log('HTTP', res.statusCode);
        console.log(body);
        process.exit(res.statusCode >=200 && res.statusCode < 300 ? 0 : 1);
      });
    });
    req.on('error', e => { console.error('Request error', e); process.exit(2); });
    req.end();
  } catch (e) { console.error(e); process.exit(3); }
})();

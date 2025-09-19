const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

(async ()=>{
  const imgPath = path.join(__dirname, '..', 'public', 'assets', 'altcoin-480.webp');
  const buf = fs.readFileSync(imgPath);
  const b64 = buf.toString('base64');
  const body = JSON.stringify({ name: 'test.webp', data: b64 });
  const res = await fetch('http://localhost:3000/api/admin/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cms-password': process.env.CMS_PASSWORD || '' }, body });
  const txt = await res.text();
  console.log('status', res.status, txt);
})();

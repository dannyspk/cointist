const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
(async ()=>{
  try {
    const cms = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), '.cms.json'),'utf8'));
    const token = jwt.sign({ user: cms.username }, cms.jwtSecret, { expiresIn: '1h' });
    const res = await fetch('http://localhost:3000/api/admin/backup', { method: 'POST', headers: { cookie: 'cms_token='+token } });
    const j = await res.json().catch(()=>({ error: 'no-json' }));
    console.log('status', res.status, 'body', j);
  } catch (e) { console.error('error', e && e.message ? e.message : e); process.exit(1); }
})();

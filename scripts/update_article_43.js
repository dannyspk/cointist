const fs = require('fs');
const jwt = require('jsonwebtoken');

(async ()=> {
  try {
    const cfg = JSON.parse(fs.readFileSync('.cms.json','utf8'));
    const token = jwt.sign({ user: cfg.username }, cfg.jwtSecret, { expiresIn: '1h' });
    const body = { featuredOnly: true };
    const res = await fetch('http://localhost:3000/api/articles/43', {
      method: 'PUT',
      headers: { 'content-type':'application/json', 'cookie': 'cms_token=' + token },
      body: JSON.stringify(body)
    });
    console.log('PUT status', res.status);
    console.log('PUT body:', await res.text());
    const res2 = await fetch('http://localhost:3000/api/articles/43');
    console.log('GET status', res2.status);
    console.log('GET body:', await res2.text());
  } catch (e) {
    console.error('Error', e);
    process.exit(1);
  }
})();

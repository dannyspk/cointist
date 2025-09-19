const fetch = require('node-fetch');
const fs = require('fs');
const jwt = require('jsonwebtoken');

(async()=>{
  const cms = JSON.parse(fs.readFileSync('.cms.json','utf8'));
  const token = jwt.sign({ user: cms.username || 'admin' }, cms.jwtSecret, { expiresIn: '1h' });
  const cookie = 'cms_token=' + token;
  const id = 17;
  const r = await fetch('http://localhost:3000/api/articles/' + id);
  const art = await r.json();
  const newContent = `<h2>Test Heading</h2><p>This is a test paragraph saved at ${new Date().toISOString()}.</p><blockquote>"This is a test pullquote added by script."</blockquote><p>Second paragraph to check spacing.</p>`;
  const payload = Object.assign({}, art, { content: newContent });
  for (let k of Object.keys(payload)) if (payload[k] === undefined) payload[k] = null;
  const put = await fetch('http://localhost:3000/api/articles/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: JSON.stringify(payload) });
  console.log('PUT status', put.status);
  console.log('PUT body', await put.text());
  const r2 = await fetch('http://localhost:3000/api/articles/' + id);
  const j2 = await r2.json();
  console.log('Saved content:', j2.content.slice(0,400));
})();

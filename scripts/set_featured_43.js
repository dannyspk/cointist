const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

async function main(){
  try{
    const cmsPath = path.resolve(process.cwd(), '.cms.json');
    if (!fs.existsSync(cmsPath)) { console.error('.cms.json not found'); process.exit(2); }
    const cfg = JSON.parse(fs.readFileSync(cmsPath,'utf8'));
    if (!cfg.jwtSecret) { console.error('jwtSecret missing in .cms.json'); process.exit(2); }
    const token = jwt.sign({ user: cfg.username || 'admin' }, cfg.jwtSecret, { expiresIn: '1h' });
    const cookie = `cms_token=${token}`;
    const url = 'http://localhost:3000/api/articles/43';
    console.log('PUT', url);
    const payload = { featuredOnly: true };
    const putRes = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json', 'cookie': cookie }, body: JSON.stringify(payload) });
    console.log('PUT status', putRes.status);
    const putText = await putRes.text();
    console.log('PUT body:', putText);

    console.log('\nGET', url);
    const getRes = await fetch(url);
    console.log('GET status', getRes.status);
    const getText = await getRes.text();
    console.log('GET body:', getText);
  } catch (e) {
    console.error('ERROR', e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

main();

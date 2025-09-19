const fs = require('fs');
const path = require('path');
const https = require('https');

function readEnv(envPath) {
  if (!fs.existsSync(envPath)) throw new Error('.gitbook.env not found');
  const raw = fs.readFileSync(envPath, 'utf8');
  const obj = {};
  raw.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) obj[m[1]] = m[2];
  });
  return obj;
}

function doRequest(pathname, token) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'api.gitbook.com',
      path: pathname,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', err => resolve({ status: 0, body: String(err) }));
    req.end();
  });
}

async function probe(space, token) {
  const candidates = [
    `/v1/spaces/${encodeURIComponent(space)}/pages`,
    `/v1/spaces/${encodeURIComponent(space)}/pages?limit=100`,
    `/v1/spaces/${encodeURIComponent(space)}/pages/tree`,
    `/v1/spaces/${encodeURIComponent(space)}/docs`,
    `/v1/spaces/${encodeURIComponent(space)}/content`,
    `/v1/search?space=${encodeURIComponent(space)}`,
    `/v1/spaces/${encodeURIComponent(space)}/pages/list`,
    `/v1/spaces/${encodeURIComponent(space)}/pages?include=children`,
    `/v1/spaces/${encodeURIComponent(space)}/pages?recursive=true`,
  ];

  for (const p of candidates) {
    console.log('-> Trying', p);
    const res = await doRequest(p, token);
    console.log(`   status: ${res.status}`);
    try {
      const json = JSON.parse(res.body);
      console.log('   body: ', JSON.stringify(json, null, 2).slice(0, 1000));
    } catch (e) {
      console.log('   body (raw):', res.body.slice(0, 800));
    }
    console.log('');
  }
}

async function main() {
  try {
    const env = readEnv(path.resolve(__dirname, '..', '.gitbook.env'));
    const token = env.GITBOOK_TOKEN; const space = env.GITBOOK_SPACE_ID;
    if (!token || !space) throw new Error('Missing GITBOOK_TOKEN or GITBOOK_SPACE_ID in .gitbook.env');
    await probe(space, token);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();

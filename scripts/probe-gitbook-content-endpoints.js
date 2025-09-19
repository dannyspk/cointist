const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.gitbook.env') });

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
if (!TOKEN || !SPACE) { console.error('Missing token/space'); process.exit(1); }

function doRequest(pathname) {
  return new Promise((resolve) => {
    const opts = { hostname: 'api.gitbook.com', path: pathname, method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', err => resolve({ status: 0, body: String(err) }));
    req.end();
  });
}

async function main() {
  const pageId = process.argv[2];
  if (!pageId) { console.error('Usage: node probe-gitbook-content-endpoints.js <pageId>'); process.exit(1); }

  const candidates = [
    `/v1/spaces/${SPACE}/pages/${pageId}/export?format=md`,
    `/v1/spaces/${SPACE}/pages/${pageId}/export?format=html`,
    `/v1/pages/${pageId}/export?format=md`,
    `/v1/pages/${pageId}/export?format=html`,
    `/v1/spaces/${SPACE}/pages/${pageId}/raw`,
    `/v1/pages/${pageId}/raw`,
    `/v1/spaces/${SPACE}/pages/${pageId}/content?format=md`,
    `/v1/spaces/${SPACE}/pages/${pageId}/content?format=html`,
    `/v1/spaces/${SPACE}/pages/${pageId}/rendered`,
    `/v1/pages/${pageId}/rendered`,
    `/v1/spaces/${SPACE}/pages/${pageId}/export`,
  ];

  for (const p of candidates) {
    console.log('->', p);
    const r = await doRequest(p);
    console.log('   status:', r.status);
    const out = (r.body || '').slice(0, 2000);
    console.log('   body head:', out.replace(/\n/g, '\\n').slice(0,800));
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });

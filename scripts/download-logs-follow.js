const https = require('https');
const fs = require('fs');
const TOKEN = process.env.GITHUB_TOKEN;
const owner = 'dannyspk';
const repo = 'cointist';
const runId = process.argv[2];
if (!TOKEN) { console.error('GITHUB_TOKEN missing'); process.exit(2); }
if (!runId) { console.error('Usage: node download-logs-follow.js <runId>'); process.exit(2); }
const path = `/repos/${owner}/${repo}/actions/runs/${runId}/logs`;
const options = { hostname: 'api.github.com', path, method: 'GET', headers: { 'User-Agent': 'cointist-agent', 'Accept': 'application/vnd.github.v3+json', 'Authorization': `token ${TOKEN}` } };
https.request(options, res => {
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    const loc = res.headers.location;
    console.log('Redirect to', loc);
    const file = fs.createWriteStream(`tmp/workflow-${runId}-logs.zip`);
    const lib = loc.startsWith('https') ? require('https') : require('http');
    lib.get(loc, r2 => {
      r2.pipe(file);
      r2.on('end', () => { console.log('Saved'); });
    }).on('error', e=> { console.error('redirect fetch error', e); process.exit(3); });
  } else if (res.statusCode === 200) {
    // sometimes returns binary directly
    const file = fs.createWriteStream(`tmp/workflow-${runId}-logs.zip`);
    res.pipe(file);
    res.on('end', () => console.log('Saved direct'));
  } else {
    let data=''; res.on('data',d=>data+=d); res.on('end',()=>{ console.error('Unexpected status', res.statusCode, data); process.exit(4); });
  }
}).on('error', e=>{ console.error('request err', e); process.exit(5); }).end();

// Lists pages in a GitBook Space using the Content API (read-only)
// Uses the working endpoint /v1/spaces/{space}/content which returns a revision
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

function getContent(spaceId, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.gitbook.com',
      path: `/v1/spaces/${encodeURIComponent(spaceId)}/content`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function printPage(p, indent = '') {
  console.log(`${indent}id: ${p.id}`);
  console.log(`${indent}title: ${p.title}`);
  if (p.path) console.log(`${indent}path: ${p.path}`);
  if (p.slug) console.log(`${indent}slug: ${p.slug}`);
  if (p.createdAt) console.log(`${indent}createdAt: ${p.createdAt}`);
  if (p.updatedAt) console.log(`${indent}updatedAt: ${p.updatedAt}`);
}

function walkPages(pages, indent = '') {
  pages.forEach(p => {
    console.log('---');
    printPage(p, indent);
    if (Array.isArray(p.pages) && p.pages.length) walkPages(p.pages, indent + '  ');
  });
}

async function main() {
  try {
    const env = readEnv(path.resolve(__dirname, '..', '.gitbook.env'));
    const token = env.GITBOOK_TOKEN; const space = env.GITBOOK_SPACE_ID;
    if (!token) throw new Error('GITBOOK_TOKEN not found in .gitbook.env');
    if (!space) throw new Error('GITBOOK_SPACE_ID not found in .gitbook.env');

    console.log(`Fetching content for GitBook space: ${space} (read-only)`);
    const res = await getContent(space, token);
    if (!res || !Array.isArray(res.pages)) {
      console.log('Unexpected API response:', JSON.stringify(res, null, 2));
      return;
    }

    walkPages(res.pages);
    console.log(`\nTop-level pages: ${res.pages.length}`);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

if (require.main === module) main();

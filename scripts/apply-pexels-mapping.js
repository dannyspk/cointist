const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');

async function main() {
  const tmpDir = path.resolve(process.cwd(), 'tmp');
  const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('pexels-latest-') && f.endsWith('.json'));
  if (!files.length) {
    console.error('No pexels summary files found in tmp/');
    process.exit(1);
  }
  // pick the newest file
  files.sort();
  const file = path.join(tmpDir, files[files.length-1]);
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  // load cms.json to sign a jwt
  const cmsFile = path.resolve(process.cwd(), '.cms.json');
  if (!fs.existsSync(cmsFile)) {
    console.error('.cms.json not found; set CMS_PASSWORD env or create .cms.json via /api/admin/setup');
    process.exit(1);
  }
  const cms = JSON.parse(fs.readFileSync(cmsFile, 'utf8'));
  if (!cms.jwtSecret) {
    console.error('jwtSecret missing in .cms.json');
    process.exit(1);
  }

  const token = jwt.sign({ user: cms.username || 'admin' }, cms.jwtSecret, { expiresIn: '1h' });
  const cookie = `cms_token=${token}; Path=/; HttpOnly`;

  const base = process.env.BASE_URL || 'http://localhost:3000';
  for (const item of data) {
    const id = item.articleId;
    const cover = item.saved && item.saved.full ? toWebPath(item.saved.full) : null;
    const thumb = item.saved && item.saved.thumb ? toWebPath(item.saved.thumb) : null;
    if (!cover || !thumb) {
      console.log(`Skipping ${id} - missing paths`);
      continue;
    }
    const url = `${base}/api/articles/${id}`;
    // fetch existing article to get current fields (we must supply required fields if published)
    let existing = {};
    try {
      const r = await fetch(url);
      if (r.ok) existing = await r.json();
    } catch (e) {}

    // Build payload: start from existing and replace images
    const payload = Object.assign({}, existing, { coverImage: cover, thumbnail: thumb });

    // Ensure tags exist: the API requires at least one tag when published
    if (!payload.tags || !Array.isArray(payload.tags) || payload.tags.length === 0) {
      if (item.saved && item.saved.keyword) payload.tags = [String(item.saved.keyword)];
      else payload.tags = ['news'];
    }

    // Ensure no undefined values
    for (const k of Object.keys(payload)) if (payload[k] === undefined) payload[k] = null;

    console.log(`Updating article ${id} -> coverImage: ${cover}, thumbnail: ${thumb}`);
    try {
      const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: JSON.stringify(payload) });
      const txt = await res.text();
      if (!res.ok) {
        console.error(`Failed to update ${id}: ${res.status} ${txt}`);
      } else {
        console.log(`Updated ${id}`);
      }
    } catch (e) {
      console.error(`Error updating ${id}: ${e.message}`);
    }
  }
}

function toWebPath(winPath) {
  // convert absolute Windows path like C:\cointistreact\public\assets\file.jpg to /assets/file.jpg
  const p = winPath.replace(/\\/g, '/');
  const idx = p.indexOf('/public/');
  if (idx !== -1) return p.slice(idx + '/public'.length);
  // fallback: use as-is
  return winPath;
}

main().catch(e => { console.error(e); process.exit(1); });

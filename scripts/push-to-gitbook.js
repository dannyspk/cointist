#!/usr/bin/env node
/**
 * Push local markdown files under docs/gitbook/ to GitBook using the Content API.
 * Requires .gitbook.env with GITBOOK_TOKEN and GITBOOK_SPACE_ID set.
 * Usage: node scripts/push-to-gitbook.js
 */
require('dotenv').config({ path: '.gitbook.env' });
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
const BRANCH = process.env.GITBOOK_BRANCH || 'main';

if (!TOKEN) {
  console.error('Missing GITBOOK_TOKEN in .gitbook.env');
  process.exit(1);
}
if (!SPACE) {
  console.error('Missing GITBOOK_SPACE_ID in .gitbook.env');
  process.exit(1);
}

const BASE = 'https://api.gitbook.com';

async function publish(pagePath, title, content) {
  const url = `${BASE}/v1/spaces/${SPACE}/pages`;
  const body = {
    title,
    content,
    // optional fields: parentId, locale, draft
    // put pages at root
    // set publish branch via query param? API does not expose branch param here; using default
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

async function main(){
  const docDir = path.join(__dirname, '..', 'docs', 'gitbook');
  if (!fs.existsSync(docDir)) {
    console.error('Docs folder not found:', docDir);
    process.exit(1);
  }
  const files = fs.readdirSync(docDir).filter(f => f.endsWith('.md'));
  for (const f of files) {
    const full = path.join(docDir, f);
    const md = fs.readFileSync(full, 'utf8');
    const title = f.replace(/\.md$/, '').replace(/[-_]/g, ' ');
    console.log('Publishing', f, 'as', title);
    try{
      const r = await publish(full, title, md);
      console.log('->', r.status, r.body && r.body.id ? `created:${r.body.id}` : JSON.stringify(r.body));
    }catch(e){
      console.error('Publish failed for', f, e && e.message ? e.message : e);
    }
  }
}

main().catch(e=>{ console.error(e); process.exit(1); });

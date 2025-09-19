#!/usr/bin/env node
/**
 * Traverse the GitBook space content tree, fetch each page's app URL (if present),
 * replace PDprotocol -> PDP in the fetched HTML, and create a new page in the space
 * with the updated content. Creates new pages only; does not delete or modify originals.
 * Usage: node scripts/scan-and-update-space-pages.js
 */
require('dotenv').config({ path: '.gitbook.env' });
const fetch = require('node-fetch');

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
const BASE = 'https://api.gitbook.com';

if (!TOKEN || !SPACE) { console.error('Missing GITBOOK_TOKEN or GITBOOK_SPACE_ID in .gitbook.env'); process.exit(1); }

async function getContentTree() {
  const url = `${BASE}/v1/spaces/${SPACE}/content`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Content fetch failed: ${res.status}`);
  return await res.json();
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/html' } });
    if (!res.ok) { return null; }
    return await res.text();
  } catch (e) { return null; }
}

function replacePD(html) {
  return html.replace(/PDprotocol/g, 'PDP');
}

async function createPage(title, content) {
  const url = `${BASE}/v1/spaces/${SPACE}/pages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content })
  });
  const j = await res.json().catch(()=>null);
  return { status: res.status, body: j };
}

async function walk(pages, results) {
  for (const p of pages) {
    try {
      if (p.urls && p.urls.app) {
        const appUrl = p.urls.app;
        process.stdout.write(`Checking ${p.path || p.title} -> `);
        const html = await fetchHtml(appUrl);
        if (!html) { console.log('no-html'); }
        else {
          if (html.includes('PDprotocol')) {
            console.log('MATCH');
            const updated = replacePD(html);
            const title = `${p.title} (PDP update)`;
            const r = await createPage(title, updated);
            console.log(' -> created status', r.status, r.body && r.body.id ? `id:${r.body.id}` : JSON.stringify(r.body));
            results.push({ page: p, created: r });
          } else {
            console.log('no-match');
          }
        }
      }
    } catch (e) { console.log('error', e.message || e); }
    if (Array.isArray(p.pages) && p.pages.length) await walk(p.pages, results);
  }
}

async function main() {
  try {
    console.log('Fetching space content tree...');
    const tree = await getContentTree();
    if (!tree || !Array.isArray(tree.pages)) { console.error('Unexpected content response'); process.exit(1); }
    const results = [];
    await walk(tree.pages, results);
    console.log('\nScan complete. Pages created:', results.length);
    results.forEach(r=>{
      console.log('-', r.page.path || r.page.title, '->', r.created.status, r.created.body && r.created.body.id ? `id:${r.created.body.id}` : JSON.stringify(r.created.body));
    });
  } catch (e) { console.error('Fatal:', e.message || e); process.exit(1); }
}

if (require.main === module) main();

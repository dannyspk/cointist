#!/usr/bin/env node
/**
 * Fetch the published GitBook page URL, replace PDprotocol -> PDP, and create a new page
 * under the paydax-whitepaper parent in the GitBook space. Prints API response.
 * Usage: node scripts/update-abstract-from-published.js <publishedUrl> <parentId>
 */
require('dotenv').config({ path: '.gitbook.env' });
const fetch = require('node-fetch');

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
const BASE = 'https://api.gitbook.com';

if (!TOKEN || !SPACE) { console.error('Missing GITBOOK_TOKEN or GITBOOK_SPACE_ID'); process.exit(1); }

const url = process.argv[2] || 'https://paydax.gitbook.io/paydax-docs/paydax-whitepaper-v6/abstract';
const parentId = process.argv[3] || 'yI3lf0LP8X8iuIPRDwAk';

async function fetchHtml(u) {
  const res = await fetch(u, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`Failed to fetch ${u}: ${res.status}`);
  return await res.text();
}

function replacePD(html) {
  return html.replace(/PDprotocol/g, 'PDP');
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)</i);
  if (m) return m[1].trim();
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1) return h1[1].replace(/<[^>]+>/g, '').trim();
  return 'Updated Page';
}

async function createPage(title, content, parentId) {
  const endpoint = `${BASE}/v1/spaces/${SPACE}/pages`;
  const body = { title, content, parentId };
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(()=>null);
  return { status: res.status, body: j };
}

async function main() {
  try {
    console.log('Fetching published URL:', url);
    const html = await fetchHtml(url);
    if (!html.includes('PDprotocol')) {
      console.log('No occurrences of PDprotocol found in fetched page. Aborting.');
      process.exit(0);
    }
    const updated = replacePD(html);
    const title = extractTitle(html) + ' (PDP update)';
    console.log('Creating new page under parent', parentId);
    const r = await createPage(title, updated, parentId);
    console.log('->', r.status, r.body && r.body.id ? `created:${r.body.id}` : JSON.stringify(r.body));
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();

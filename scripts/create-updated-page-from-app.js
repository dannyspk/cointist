#!/usr/bin/env node
/**
 * Fetch a GitBook app URL, replace PDprotocol -> PDP in the HTML, and create a new page in the space.
 * Usage: node scripts/create-updated-page-from-app.js <appUrl>
 * If no URL provided, defaults to the Paydax whitepaper URL in this repo's known space.
 */
require('dotenv').config({ path: '.gitbook.env' });
const fetch = require('node-fetch');

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
const BASE = 'https://api.gitbook.com';

if (!TOKEN || !SPACE) { console.error('Missing GITBOOK_TOKEN or GITBOOK_SPACE_ID in .gitbook.env'); process.exit(1); }

const defaultUrl = 'https://app.gitbook.com/s/JmF4lLu8iJcO8Vrddf9g/paydax-whitepaper-v6';
const appUrl = process.argv[2] || defaultUrl;

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
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

async function createPage(title, content) {
  const url = `${BASE}/v1/spaces/${SPACE}/pages`;
  const body = { title, content };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(()=>null);
  return { status: res.status, body: j };
}

async function main() {
  try {
    console.log('Fetching app URL:', appUrl);
    const html = await fetchHtml(appUrl);
    const updated = replacePD(html);
    const title = extractTitle(html) + ' (PDP update)';

    if (updated === html) {
      console.log('No occurrences of PDprotocol found in fetched HTML; aborting.');
      process.exit(0);
    }

    console.log('Creating new page in GitBook space:', SPACE);
    const r = await createPage(title, updated);
    console.log('->', r.status, r.body && r.body.id ? `created:${r.body.id}` : JSON.stringify(r.body));
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
}

if (require.main === module) main();

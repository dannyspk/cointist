#!/usr/bin/env node
/**
 * Fetch a GitBook page by id, replace "PDprotocol" with "PDP" in its content,
 * and update the page in the space. Tries several endpoints (best-effort).
 * Usage: node scripts/update-gitbook-page.js <pageId>
 */
require('dotenv').config({ path: '.gitbook.env' });
const fetch = require('node-fetch');

const TOKEN = process.env.GITBOOK_TOKEN;
const SPACE = process.env.GITBOOK_SPACE_ID;
const BASE = 'https://api.gitbook.com';

if (!TOKEN || !SPACE) {
  console.error('Missing GITBOOK_TOKEN or GITBOOK_SPACE_ID in .gitbook.env');
  process.exit(1);
}

const pageId = process.argv[2];
if (!pageId) {
  console.error('Usage: node scripts/update-gitbook-page.js <pageId>');
  process.exit(1);
}

async function tryGet(url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } });
  const body = await res.text();
  try { return { status: res.status, json: JSON.parse(body) }; } catch (_) { return { status: res.status, text: body }; }
}

async function tryPatch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await res.json().catch(()=>null);
  return { status: res.status, body: j || null };
}

async function main() {
  console.log('Attempting to fetch page', pageId);
  const getCandidates = [
    `${BASE}/v1/spaces/${SPACE}/pages/${pageId}`,
    `${BASE}/v1/pages/${pageId}`,
    `${BASE}/v1/spaces/${SPACE}/pages/${pageId}/content`,
    `${BASE}/v1/pages/${pageId}/content`,
    // fallback: fetch space content and search
    `${BASE}/v1/spaces/${SPACE}/content`
  ];

  let found = null;
  for (const u of getCandidates) {
    try {
      console.log('GET', u);
      const res = await tryGet(u);
      console.log(' ->', res.status);
      if (res.json && (res.json.content || typeof res.json === 'object')) {
        // if endpoint returns content or a rich object, keep it
        found = { url: u, res: res.json };
        break;
      }
      // if text body present and seems to be content
      if (res.text && typeof res.text === 'string' && res.status === 200) {
        found = { url: u, res: { content: res.text } };
        break;
      }
    } catch (e) {
      console.log('  error', e.message || e);
    }
  }

  if (!found) {
    console.error('Could not fetch page content from known endpoints. Aborting.');
    process.exit(1);
  }

  // Attempt to extract content
  const source = found.res;
  let content = source.content || source.body || source.markdown || null;
  let title = source.title || null;

  // If we got a revision object from /content, find the page in pages tree
  if (!content && Array.isArray(source.pages)) {
    function findPage(pages) {
      for (const p of pages) {
        if (p.id === pageId) return p;
        if (Array.isArray(p.pages)) {
          const r = findPage(p.pages);
          if (r) return r;
        }
      }
      return null;
    }
    const p = findPage(source.pages);
    if (p) {
      title = title || p.title;
      // Content is not included in this listing; we cannot safely patch without body.
      console.log('Found page metadata in space content listing. No body available via this endpoint.');
    }
  }

  if (!content) {
    console.error('No editable page content found via GET. The Content API returns metadata only for this endpoint.');
    console.error('To proceed I need either the current page body or permission to overwrite with new content.');
    process.exit(1);
  }

  // perform replacement
  const replaced = content.replace(/PDprotocol/g, 'PDP');
  if (replaced === content) {
    console.log('No occurrences of "PDprotocol" found in content. No update necessary.');
    process.exit(0);
  }

  console.log('Found occurrences to replace. Attempting to update the page...');

  // Try patch endpoints
  const patchCandidates = [
    `${BASE}/v1/spaces/${SPACE}/pages/${pageId}`,
    `${BASE}/v1/pages/${pageId}`
  ];

  let updated = null;
  for (const pu of patchCandidates) {
    try {
      console.log('PATCH', pu);
      const body = { content: replaced };
      if (title) body.title = title;
      const r = await tryPatch(pu, body);
      console.log(' ->', r.status, r.body && r.body.id ? `id:${r.body.id}` : JSON.stringify(r.body));
      if (r.status >= 200 && r.status < 300) { updated = r.body; break; }
    } catch (e) {
      console.log('  patch error', e.message || e);
    }
  }

  if (!updated) {
    console.error('Update attempts failed on known endpoints. Response logs above.');
    process.exit(1);
  }

  console.log('Update successful:', updated);
}

main().catch(e=>{ console.error(e); process.exit(1); });

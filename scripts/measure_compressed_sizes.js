#!/usr/bin/env node
// measure_compressed_sizes.js
// Usage: node measure_compressed_sizes.js <url>
// Fetches the HTML (raw) and assets with Accept-Encoding: br, gzip and reports compressed byte sizes.

const http = require('http');
const https = require('https');
const { URL } = require('url');
const zlib = require('zlib');

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = { method: 'GET', headers };
    const req = lib.request(u, opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ buf, headers: res.headers, statusCode: res.statusCode });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function absolute(base, href) {
  try {
    return new URL(href, base).toString();
  } catch (e) {
    return null;
  }
}

(async function main(){
  const arg = process.argv[2];
  if (!arg) { console.error('Usage: node measure_compressed_sizes.js <url>'); process.exit(2); }
  const baseUrl = arg.endsWith('/') ? arg : arg + '/';
  console.log('Measuring compressed transfer sizes for:', baseUrl);

  // fetch HTML without automatic decompression by requesting raw bytes
  const headers = { 'Accept-Encoding': 'br, gzip' };
  let htmlResp;
  try { htmlResp = await get(baseUrl, headers); } catch (e) { console.error('ERROR fetching HTML', e); process.exit(1); }

  const htmlCompressedBytes = htmlResp.buf.length;
  const htmlEnc = htmlResp.headers['content-encoding'] || 'identity';
  console.log('HTML_COMPRESSED_BYTES:', htmlCompressedBytes, 'encoding:', htmlEnc);

  const html = htmlResp.buf.toString('utf8');
  const re = /(?:src|href)=["']([^"']+)["']/g;
  const matches = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('data:')) continue;
    const abs = absolute(baseUrl, href);
    if (abs) matches.add(abs);
  }
  const assets = Array.from(matches).filter(u => {
    // only include same-origin or assets hosted on known hosts; allow https/http
    try { const p = new URL(u); return true; } catch(e){ return false }
  });
  console.log('ASSETS_FOUND:', assets.length);

  let total = htmlCompressedBytes;
  for (const a of assets) {
    // only attempt http(s) URLs
    try {
      const r = await get(a, headers);
      const bytes = r.buf.length;
      const enc = r.headers['content-encoding'] || 'identity';
      console.log(a, '->', bytes, 'encoding:', enc);
      total += bytes;
    } catch (e) {
      console.log('FAILED:', a, e.message);
    }
  }
  console.log('TOTAL_COMPRESSED_BYTES:', total);
  process.exit(0);
})();

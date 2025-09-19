#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');

function getFetch() {
  if (typeof globalThis !== 'undefined' && typeof globalThis.fetch !== 'undefined') return globalThis.fetch.bind(globalThis);
  try { return require('node-fetch'); } catch (e) { throw new Error('fetch is not available; run on Node 18+ or npm i node-fetch'); }
}
const fetch = getFetch();

const API_BASE = 'https://api.openai.com/v1';

async function listModels(apiKey) {
  const res = await fetch(`${API_BASE}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`models list failed: ${res.status} ${res.statusText} - ${await res.text()}`);
  return res.json();
}

async function tryResponsesImage(apiKey, model, prompt) {
  const body = { model, input: `Generate a tiny 64x64 PNG: a single centred black square on white background. Return the image as base64 in the response if you can. Respond in JSON with a field named b64_json containing only the base64.` };
  const res = await fetch(`${API_BASE}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text: txt };
  let json;
  try { json = JSON.parse(txt); } catch (e) { return { ok: false, status: res.status, text: txt, parseError: String(e) }; }
  // try common locations for image/base64
  // 1) json.output array
  if (Array.isArray(json.output)) {
    for (const out of json.output) {
      if (out && out.type === 'image' && out.image && out.image.b64_json) return { ok: true, b64: out.image.b64_json, json };
      if (out && out.content && Array.isArray(out.content)) {
        for (const c of out.content) {
          if (c && c.type === 'image' && c.image && c.image.b64_json) return { ok: true, b64: c.image.b64_json, json };
        }
      }
    }
  }
  // 2) json.data[0].b64_json
  if (json && json.data && Array.isArray(json.data) && json.data[0] && json.data[0].b64_json) return { ok: true, b64: json.data[0].b64_json, json };
  // 3) json.output_text might embed a data URL or base64
  if (json.output_text && typeof json.output_text === 'string') {
    const m = json.output_text.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\n\r]+)/);
    if (m) return { ok: true, b64: m[2], json };
    // fallback: try to find a bare base64 block
    const m2 = json.output_text.match(/([A-Za-z0-9+/=]{200,})/);
    if (m2) return { ok: true, b64: m2[1], json };
  }
  return { ok: false, json };
}

function sanitizeModelId(id) { return id.replace(/[^a-z0-9\-_.]/gi, '_'); }

async function run() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) { console.error('OPENAI_API_KEY not set'); process.exit(2); }
  console.log('Listing models...');
  const mdl = await listModels(apiKey);
  const all = Array.isArray(mdl.data) ? mdl.data.map(d => d.id) : [];
  // Candidate regex: models mentioning image/dall/gpt-image/vision
  const re = /(dall|dalle|image|vision|gpt-image|gpt-5-image|gpt-5)/i;
  const candidates = all.filter(id => re.test(id));
  // allow override via --models=id,id
  const argv = process.argv.slice(2);
  const mArg = argv.find(a => a.startsWith('--models='));
  if (mArg) {
    const list = mArg.split('=')[1];
    if (list) candidates.splice(0, candidates.length, ...list.split(',').map(s=>s.trim()).filter(Boolean));
  }
  if (candidates.length === 0) { console.log('No image-like candidates found in model list'); process.exit(0); }
  console.log('Probing candidates:', candidates.join(', '));
  const outDir = path.join(process.cwd(), 'tmp', 'probe-images');
  await fs.promises.mkdir(outDir, { recursive: true });
  const results = [];
  for (const c of candidates) {
    console.log('Trying model:', c);
    try {
      const r = await tryResponsesImage(apiKey, c, 'small test');
      if (r.ok) {
        const filename = path.join(outDir, `${sanitizeModelId(c)}.png`);
        await fs.promises.writeFile(filename, Buffer.from(r.b64, 'base64'));
        console.log('SUCCESS -> saved:', filename);
        results.push({ model: c, ok: true, saved: filename });
        break; // stop at first success
      } else {
        console.log('Failed:', c, r.status || '', r.text ? (r.text.length > 200 ? r.text.slice(0,200)+'...' : r.text) : (r.json ? JSON.stringify(r.json).slice(0,200) : 'no details'));
        results.push({ model: c, ok: false, detail: r });
      }
    } catch (e) {
      console.log('Error probing', c, e && e.message ? e.message : e);
      results.push({ model: c, ok: false, error: String(e) });
    }
  }
  console.log('\nSummary:');
  console.log(JSON.stringify(results, null, 2));
}

run().catch(e => { console.error('Fatal error:', e && e.message ? e.message : e); process.exit(1); });

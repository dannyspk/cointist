#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');

function getFetch() {
  // prefer the global fetch when available (Node 18+)
  if (typeof globalThis !== 'undefined' && typeof globalThis.fetch !== 'undefined') return globalThis.fetch.bind(globalThis);
  try {
    // node <18 fallback if node-fetch is installed
    // eslint-disable-next-line global-require
    const nf = require('node-fetch');
    return nf;
  } catch (e) {
    throw new Error('fetch is not available; run on Node 18+ or `npm install node-fetch`');
  }
}

const fetch = getFetch();
const responsesClient = require('./openai-responses-client');

function stripHtml(s) {
  if (!s) return '';
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function callImagesAPI({ model = 'gpt-image-1', prompt, size = '1024x1024', response_format, apiKey }) {
  if (!apiKey) apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPENAI;
  if (!apiKey) throw new Error('OPENAI_API_KEY environment variable is required');
  // debug: log which model we're requesting (do not print full API key)
  try {
    const keyPresent = !!apiKey;
    console.log(`Calling Images API with model=${model} (API key present=${keyPresent})`);
  } catch (e) {
    // ignore logging errors
  }
  const url = 'https://api.openai.com/v1/images/generations';
  const body = { model, prompt, size };
  if (typeof response_format !== 'undefined' && response_format !== null) body.response_format = response_format;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    // Some image models/endpoints don't accept the `response_format` parameter.
    // If that's the cause, retry once without the parameter.
    if (typeof body.response_format !== 'undefined' && /Unknown parameter: 'response_format'|Unknown parameter: \"response_format\"/.test(txt)) {
      // retry without response_format
      delete body.response_format;
      const retryRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!retryRes.ok) {
        const retryTxt = await retryRes.text();
        throw new Error(`Images API error (retry without response_format): ${retryRes.status} ${retryRes.statusText} - ${retryTxt}`);
      }
      return retryRes.json();
    }
    throw new Error(`Images API error: ${res.status} ${res.statusText} - ${txt}`);
  }
  return res.json();
}

async function saveBase64Image(b64, outPath) {
  const buf = Buffer.from(b64, 'base64');
  await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
  await fs.promises.writeFile(outPath, buf);
  return outPath;
}

async function callResponsesAPIForImage({ model = 'gpt-5-chat-latest', prompt, size = '1024x1024', apiKey }) {
  // Ask for strict machine-readable JSON containing a single b64_json field
  const reqPrompt = `Generate an image for: ${prompt}. Return ONLY a JSON object with a single field named \"b64_json\" whose value is the base64 PNG data (no other text). Example: { "b64_json": "<base64>" }`;
  return responsesClient.callResponses({ model, input: reqPrompt, apiKey, max_output_tokens: 8000 });
}

async function generateArticleImage(article, opts = {}) {
  const { size = '1024x1024', response_format, outDir = path.join(process.cwd(), 'tmp', 'images'), apiKey } = opts;
  const useResponses = typeof opts.useResponses !== 'undefined' ? !!opts.useResponses : true;
  // If caller provided an explicit model use it; otherwise choose a sensible default based on the API path
  const model = typeof opts.model !== 'undefined' ? opts.model : (useResponses ? 'gpt-5-chat-latest' : 'gpt-image-1');
  if (!article) throw new Error('article is required');
  const title = article.title || article.slug || article.id || 'article';
  const excerpt = stripHtml(article.excerpt || article.summary || '');
  const summary = stripHtml(article.summary || '');
  // allow callers to request a style variant (3d | photo | random | custom text)
  const styleChoice = (opts.style || '').toLowerCase(); // '3d' | 'photo' | 'random' | explicit style text
  const STYLE_MAP = {
    '3d': '3D render, cinematic studio lighting, soft shadows, subsurface scattering, detailed materials, shallow depth of field, stylized but realistic materials',
    'photo': 'photorealistic, ultra-detailed, natural lighting, realistic textures, cinematic composition, high dynamic range'
  };
  // allow "random" to pick between the two
  let styleSuffix;
  if (styleChoice === 'random' || !styleChoice) {
    // default: pick photo when no preference; if explicitly 'random' choose randomly
    const pick = styleChoice === 'random' ? (Math.random() < 0.5 ? '3d' : 'photo') : 'photo';
    styleSuffix = STYLE_MAP[pick];
  } else {
    styleSuffix = STYLE_MAP[styleChoice] || styleChoice; // allow freeform custom text
  }

  // Prefer an explicit article excerpt when available for a more focused image prompt.
  const promptBase = opts.prompt || (excerpt ? `${excerpt}. Create an editorial hero image suitable for a news article: clean composition, center subject, neutral background, subtle modern palette. Avoid text and logos. High quality, 16:9 crop.` : `${title}. ${summary ? `Summary: ${summary}. ` : ''}Create an editorial hero image suitable for a news article: clean composition, center subject, neutral background, subtle modern palette. Avoid text and logos. High quality, 16:9 crop.`);
  const prompt = `${promptBase} Style: ${styleSuffix}.`;
  const slug = article.slug || (title.toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80) || String(article.id || 'article'));
  const outPath = path.join(outDir, `${slug}.png`);
  // If requested, use Responses API exclusively (do not fallback silently to Images API)
  if (useResponses) {
    try {
      const rjson = await callResponsesAPIForImage({ model, prompt, size, apiKey });
      // Try to find base64 in several common locations
      // 1) new Responses API may include output array with content items
      if (rjson && Array.isArray(rjson.output)) {
        for (const out of rjson.output) {
          if (out && out.type === 'image' && out.image && out.image.b64_json) {
            await saveBase64Image(out.image.b64_json, outPath);
            return { outPath, slug, prompt, model, via: 'responses' };
          }
          if (out && out.content && Array.isArray(out.content)) {
            for (const c of out.content) {
              if (c && c.type === 'image' && c.image && c.image.b64_json) {
                await saveBase64Image(c.image.b64_json, outPath);
                return { outPath, slug, prompt, model, via: 'responses' };
              }
              // sometimes the content item may include a data.url
              if (c && c.type === 'output_image' && c.url) {
                const r = await fetch(c.url);
                if (!r.ok) throw new Error(`Could not download image URL from responses output: ${r.status}`);
                const arrayBuf = await r.arrayBuffer();
                await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
                await fs.promises.writeFile(outPath, Buffer.from(arrayBuf));
                return { outPath, slug, prompt, model, via: 'responses' };
              }
            }
          }
        }
      }
      // 1b) check for 'output_text' fields that may contain JSON/code fences with b64_json
      const tryExtractFromOutputText = (text) => {
        if (!text || typeof text !== 'string') return null;
        // remove triple backticks and language tags
        let t = text.replace(/```[a-zA-Z0-9\-]*\n/g, '').replace(/```/g, '').trim();
        // try to find a JSON object inside the text
        const jsonMatch = t.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const obj = JSON.parse(jsonMatch[0]);
            if (obj && obj.b64_json) return obj.b64_json;
            // sometimes nested like { "b64_json": "..." }
          } catch (e) {
            // ignore JSON parse errors
          }
        }
        // look for data URI
        const dataMatch = t.match(/data:image\/(png|jpeg);base64,([A-Za-z0-9+/=\n\r]+)/);
        if (dataMatch) return dataMatch[2].replace(/\s+/g, '');
        // fallback: find long base64-like blob
        const base64Match = t.match(/([A-Za-z0-9+/=]{200,})/);
        if (base64Match) return base64Match[1].replace(/\s+/g, '');
        return null;
      };
      if (rjson && Array.isArray(rjson.output)) {
        for (const out of rjson.output) {
          if (out && out.content && Array.isArray(out.content)) {
            for (const c of out.content) {
              if (c && c.type === 'output_text' && c.text) {
                const maybe = tryExtractFromOutputText(c.text);
                if (maybe) { await saveBase64Image(maybe, outPath); return { outPath, slug, prompt, model, via: 'responses' }; }
              }
            }
          }
          if (out && out.type === 'message' && out.content && Array.isArray(out.content)) {
            for (const m of out.content) {
              if (m && m.type === 'output_text' && m.text) {
                const maybe = tryExtractFromOutputText(m.text);
                if (maybe) { await saveBase64Image(maybe, outPath); return { outPath, slug, prompt, model, via: 'responses' }; }
              }
            }
          }
        }
      }
      // 2) older/alternate shapes: check for data array
      if (rjson && rjson.data && Array.isArray(rjson.data) && rjson.data[0]) {
        const d0 = rjson.data[0];
        if (d0.b64_json) {
          await saveBase64Image(d0.b64_json, outPath);
          return { outPath, slug, prompt, model, via: 'responses' };
        }
        if (d0.url) {
          const r = await fetch(d0.url);
          if (!r.ok) throw new Error(`Could not download image URL from responses data: ${r.status}`);
          const arrayBuf = await r.arrayBuffer();
          await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
          await fs.promises.writeFile(outPath, Buffer.from(arrayBuf));
          return { outPath, slug, prompt, model, via: 'responses' };
        }
      }
      // 3) also check top-level output_text
      if (rjson && rjson.output_text && typeof rjson.output_text === 'string') {
        const maybe = tryExtractFromOutputText(rjson.output_text);
        if (maybe) { await saveBase64Image(maybe, outPath); return { outPath, slug, prompt, model, via: 'responses' }; }
      }
    } catch (e) {
      // If Responses fails (gating, parse error, or no image), fall back to the Images API using gpt-image-1
      console.warn('Responses path failed or did not return an image, falling back to Images API (gpt-image-1):', e && e.message ? e.message : String(e));
      try {
        const fbModel = 'gpt-image-1';
  const fbRespFormat = typeof response_format !== 'undefined' ? response_format : 'b64_json';
  console.log(`Images API fallback: requesting model=${fbModel} with response_format=${fbRespFormat}`);
  const json = await callImagesAPI({ model: fbModel, prompt, size, response_format: fbRespFormat, apiKey });
        if (json && json.data && json.data[0] && json.data[0].b64_json) {
          await saveBase64Image(json.data[0].b64_json, outPath);
          return { outPath, slug, prompt, model: fbModel, via: 'images-fallback' };
        }
        if (json && json.data && json.data[0] && json.data[0].url) {
          console.log('Images API fallback returned URL instead of b64_json; JSON:', JSON.stringify(json));
          // write JSON to disk for inspection
          try {
            const dbgDir = path.join(process.cwd(), 'tmp', 'images-responses-json');
            await fs.promises.mkdir(dbgDir, { recursive: true });
            const dbgPath = path.join(dbgDir, `${slug}.json`);
            await fs.promises.writeFile(dbgPath, JSON.stringify(json, null, 2));
            console.log('Wrote Images API JSON to', dbgPath);
          } catch (werr) {
            console.warn('Failed to write Images API JSON for debug:', werr && werr.message ? werr.message : String(werr));
          }
          // Try a second Images API call forcing b64_json explicitly
          try {
            const retryJson = await callImagesAPI({ model: fbModel, prompt, size, response_format: 'b64_json', apiKey });
            if (retryJson && retryJson.data && retryJson.data[0] && retryJson.data[0].b64_json) {
              await saveBase64Image(retryJson.data[0].b64_json, outPath);
              return { outPath, slug, prompt, model: fbModel, via: 'images-fallback-retry-b64' };
            }
          } catch (retryErr) {
            console.warn('Retrying Images API with response_format=b64_json failed:', retryErr && retryErr.message ? retryErr.message : String(retryErr));
          }

          // Last resort: try to download the URL directly (no auth header)
          const imageUrl = json.data[0].url;
          const r = await fetch(imageUrl);
          if (!r.ok) {
            // include JSON in error to help debugging
            throw new Error(`Could not download image URL from fallback: ${r.status} ${r.statusText}. Images API response: ${JSON.stringify(json)}`);
          }
          const arrayBuf = await r.arrayBuffer();
          await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
          await fs.promises.writeFile(outPath, Buffer.from(arrayBuf));
          return { outPath, slug, prompt, model: fbModel, via: 'images-fallback' };
        }
        throw new Error('Images API fallback returned unexpected response shape: ' + JSON.stringify(json));
      } catch (fbErr) {
        throw new Error('Responses API image parse failed and Images API fallback also failed: ' + (fbErr && fbErr.message ? fbErr.message : String(fbErr)));
      }
    }
  }

  // If useResponses is false, fall back to the classic Images API
  const json = await callImagesAPI({ model, prompt, size, response_format, apiKey });
  // Prefer b64_json, fallback to url
  if (json && json.data && json.data[0] && json.data[0].b64_json) {
    await saveBase64Image(json.data[0].b64_json, outPath);
    return { outPath, slug, prompt, model, via: 'images' };
  }
  if (json && json.data && json.data[0] && json.data[0].url) {
    // attempt to download the returned URL (do not send our API key when fetching)
    const imageUrl = json.data[0].url;
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Could not download image URL: ${r.status} ${r.statusText}`);
    const arrayBuf = await r.arrayBuffer();
    await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
    await fs.promises.writeFile(outPath, Buffer.from(arrayBuf));
    return { outPath, slug, prompt, model, via: 'images' };
  }
  throw new Error('Images API returned unexpected response shape: ' + JSON.stringify(json));
}

// CLI: process a selection file or single article
async function mainCli() {
  const argv = process.argv.slice(2);
  const args = {};
  argv.forEach(a => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  });
  const apiKey = args.key || process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  const model = Object.prototype.hasOwnProperty.call(args, 'model') ? args.model : undefined;
  const size = args.size || '1024x1024';
  const style = Object.prototype.hasOwnProperty.call(args, 'style') ? args.style : undefined;
  const respFormat = Object.prototype.hasOwnProperty.call(args, 'response_format') ? args.response_format : undefined;
  const useResponses = Object.prototype.hasOwnProperty.call(args, 'use-responses') || Object.prototype.hasOwnProperty.call(args, 'use_responses') || false;
  if (args.selection) {
    const selPath = path.resolve(process.cwd(), args.selection);
    if (!fs.existsSync(selPath)) throw new Error('selection file not found: ' + selPath);
  const raw = fs.readFileSync(selPath, 'utf8');
  const j = JSON.parse(raw);
  // Support multiple selection file shapes: { selected: [...] }, { items: [...] }, or a raw array
  let items = [];
  if (Array.isArray(j)) items = j;
  else if (Array.isArray(j.selected)) items = j.selected;
  else if (Array.isArray(j.items)) items = j.items;
  else items = Array.isArray(j.selected) ? j.selected : (j.selected || []);
  console.log(`Loaded selection from ${selPath} — found ${items.length} item(s)`);
  const selectionBasename = path.basename(selPath, path.extname(selPath));
  for (const it of items) {
      // ensure each item has a slug; default to the selection filename when missing
      if (!it.slug || typeof it.slug !== 'string' || it.slug.trim() === '') {
        it.slug = selectionBasename;
      }
      try {
        console.log('Generating image for', it.title || it.id);
  const res = await generateArticleImage(it, { model, size, response_format: respFormat, apiKey, useResponses, style });
        console.log('Saved image:', res.outPath);
      } catch (e) {
        console.error('Error for', it.id, e && e.message ? e.message : e);
      }
    }
    return;
  }
  // single-article mode using --title and optional --slug
  if (args.title) {
    const art = { title: args.title, summary: args.summary || '', slug: args.slug };
  const res = await generateArticleImage(art, { model, size, response_format: respFormat, apiKey, style });
    console.log('Saved image:', res.outPath);
    return;
  }
  console.log('Usage: generate-article-image.js --selection=tmp/selected.json [--model=] [--response_format=b64_json]');
}

if (require.main === module) {
  mainCli().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
}

module.exports = { generateArticleImage };

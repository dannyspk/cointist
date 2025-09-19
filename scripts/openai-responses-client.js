#!/usr/bin/env node
"use strict";
const fetch = (typeof globalThis !== 'undefined' && globalThis.fetch) ? globalThis.fetch.bind(globalThis) : (() => { try { return require('node-fetch'); } catch (e) { throw new Error('fetch not available; use Node 18+ or install node-fetch'); } })();
const API = 'https://api.openai.com/v1';

async function callResponses({ model, input, apiKey, max_output_tokens }) {
  if (!apiKey) apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');
  const body = { model, input };
  if (typeof max_output_tokens !== 'undefined') body.max_output_tokens = max_output_tokens;
  const res = await fetch(`${API}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch (e) { throw new Error(`Responses API parse error: ${e.message}: ${text.slice(0,200)}`); }
  if (!res.ok) {
    const err = json && json.error ? (json.error.message || JSON.stringify(json.error)) : text;
    const code = res.status;
    const e = new Error(`Responses API error: ${code} - ${err}`);
    e.status = code;
    e.body = json;
    throw e;
  }
  return json;
}

module.exports = { callResponses };

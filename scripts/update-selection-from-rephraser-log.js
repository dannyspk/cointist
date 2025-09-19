#!/usr/bin/env node
/*
 Parse tmp/pipeline-rephraser.log and extract the latest Supabase select raw response JSON blocks.
 For each select response found, take data.id, data.slug, data.title, data.excerpt and write tmp/selection-from-pipeline.json
 and tmp/selected.json using those latest rows (dedupe by id). This file is intended to be authoritative and used by aggregator.
*/

const fs = require('fs');
const path = require('path');

const LOG = path.join(process.cwd(), 'tmp', 'pipeline-rephraser.log');
const SEL_PATH = path.join(process.cwd(), 'tmp', 'selection-from-pipeline.json');
const SELECTED_JSON = path.join(process.cwd(), 'tmp', 'selected.json');

if (!fs.existsSync(LOG)) {
  console.error('Rephraser log not found:', LOG);
  process.exit(1);
}

// Read the log with a small retry loop to handle races where the rephraser
// process spawned this updater before the log was fully flushed to disk.
function readLogWithRetries(attempts = 5, delayMs = 150) {
  for (let i = 0; i < attempts; i++) {
    try {
      return fs.readFileSync(LOG, 'utf8');
    } catch (e) {
      if (i === attempts - 1) throw e;
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs); } catch(_) { /* best-effort sleep */ }
    }
  }
}

const content = readLogWithRetries();

// Find the most recent rephraser spawn line (timestamped) to limit parsing to the latest run
// Lines look like: 2025-09-14T04:59:09.277Z [rephraser] model= gpt-4o-mini
const lines = content.split(/\r?\n/);
let lastSpawnIndex = -1;
for (let i = lines.length - 1; i >= 0; i--) {
  if (/\[rephraser\] model=/i.test(lines[i])) { lastSpawnIndex = i; break; }
}
const contentAfterSpawn = lastSpawnIndex >= 0 ? lines.slice(lastSpawnIndex).join('\n') : content;

// Robust JSON extraction: scan for all {...} JSON blocks by matching braces and try to parse.
function extractJsonObjects(s) {
  const results = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}') depth--;
      if (depth === 0) {
        const substr = s.slice(i, j + 1);
        try {
          const obj = JSON.parse(substr);
          results.push(obj);
          // advance i to j to avoid nested rescans
          i = j;
        } catch (e) {
          // not valid JSON, continue scanning
        }
        break;
      }
    }
  }
  return results;
}

const allJson = extractJsonObjects(contentAfterSpawn);
// Flatten responses: Supabase select responses may have data as an array or a single object.
// We want to iterate in log order and keep the "last seen" row for each id/slug.
const entries = [];
for (const obj of allJson) {
  if (!obj || typeof obj !== 'object') continue;
  const d = obj.data;
  if (!d) continue;
  if (Array.isArray(d)) {
    for (const row of d) {
      if (row && (row.id || row.slug || row.title)) entries.push(row);
    }
  } else if (typeof d === 'object') {
    if (d && (d.id || d.slug || d.title)) entries.push(d);
  }
}

if (!entries.length) {
  console.error('No Supabase select rows found in log.');
  process.exit(2);
}

// Keep only the last occurrence for each distinct data.id (preserve order of last-seen)
const byId = new Map();
for (const data of entries) {
  const id = data.id || null;
  const key = id ? String(id) : (data.slug ? `slug:${data.slug}` : null);
  if (!key) continue;
  // override so the last seen remains
  byId.set(key, data);
}

const items = Array.from(byId.values()).map(d => ({ id: d.id, slug: d.slug, title: d.title || '', excerpt: d.excerpt || '' }));

// write selection-from-pipeline.json (backup if exists)
if (fs.existsSync(SEL_PATH)) {
  fs.copyFileSync(SEL_PATH, SEL_PATH + '.' + Date.now() + '.bak');
}
fs.writeFileSync(SEL_PATH, JSON.stringify({ selected: items.map(i => ({ id: i.id, slug: i.slug, title: i.title, summary: i.excerpt })) , updatedFromLogAt: new Date().toISOString() }, null, 2), 'utf8');
fs.writeFileSync(SELECTED_JSON, JSON.stringify({ count: items.length, items: items.map(i => ({ id: i.id, slug: i.slug, title: i.title, excerpt: i.excerpt })), createdAt: new Date().toISOString(), source: LOG }, null, 2), 'utf8');
console.log('Updated selection files from rephraser log. Items:', items.length);
process.exit(0);

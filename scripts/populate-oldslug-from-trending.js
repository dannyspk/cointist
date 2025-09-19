#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function slugifyTitle(s) {
  if (!s) return null;
  return String(s)
    .toLowerCase()
    .replace(/[\s\t\n\r]+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const repoRoot = process.cwd();
const selPath = path.join(repoRoot, 'tmp', 'selected.json');
const trendPath = path.join(repoRoot, 'tmp', 'trending-aggregator-last.json');

if (!fs.existsSync(selPath)) { console.error('Missing', selPath); process.exit(1); }
if (!fs.existsSync(trendPath)) { console.error('Missing', trendPath); process.exit(1); }

const selected = JSON.parse(fs.readFileSync(selPath, 'utf8'));
const trending = JSON.parse(fs.readFileSync(trendPath, 'utf8'));

// build map of trending by normalized title -> slugified title
const titleMap = new Map();
for (const t of trending) {
  const title = t.title || '';
  const key = title.trim().toLowerCase();
  if (!key) continue;
  titleMap.set(key, slugifyTitle(title));
}

let changed = false;
for (const it of selected.items) {
  if (it.oldslug) continue;
  const title = (it.title || '').trim().toLowerCase();
  if (!title) continue;
  if (titleMap.has(title)) {
    it.oldslug = titleMap.get(title);
    changed = true;
    console.log('Set oldslug for', it.slug || it.id, '=>', it.oldslug);
  } else {
    // fallback: slugify the selected title directly
    it.oldslug = slugifyTitle(it.title || it.slug || '');
    changed = true;
    console.log('Fallback oldslug for', it.slug || it.id, '=>', it.oldslug);
  }
}

if (changed) {
  const bak = selPath + '.bak.' + Date.now();
  fs.writeFileSync(bak, JSON.stringify(JSON.parse(fs.readFileSync(selPath,'utf8')), null, 2), 'utf8');
  fs.writeFileSync(selPath, JSON.stringify(selected, null, 2), 'utf8');
  console.log('Wrote', selPath, '(backup at', bak + ')');
} else {
  console.log('No changes needed');
}

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const cfgPath = path.join(ROOT, 'scripts', 'db-image-tables.json');
const outPath = path.join(ROOT, 'tmp', 'update-image-urls.sql');

// Default example config if none exists
const defaultCfg = [
  { table: 'Article', column: 'coverImage' },
  { table: 'Article', column: 'thumbnail' },
  { table: 'Guides', column: 'coverImage' },
  { table: 'Guides', column: 'thumbnail' },
  // legacy examples you can add or remove
  { table: 'authors', column: 'avatar_url' },
  { table: 'uploads', column: 'path' }
];

let cfg = defaultCfg;
if (fs.existsSync(cfgPath)) {
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch (e) { console.warn('Failed to read config, using defaults'); }
}

const lines = [];
lines.push('-- Generated SQL to update image URL extensions to .webp');
lines.push('-- Review before running. Backup your DB first.');
lines.push(`-- generatedAt: ${new Date().toISOString()}`);
lines.push('BEGIN;');
for (const entry of cfg) {
  const t = entry.table;
  const c = entry.column;
  // Use regexp_replace to replace trailing extension, case-insensitive
  lines.push(`/* ${t}.${c} */`);
  lines.push(`UPDATE ${t}
SET ${c} = regexp_replace(${c}, '\\.(png|jpe?g)$', '.webp', 'i')
WHERE ${c} ~* '\\.(png|jpe?g)$';`);
  lines.push('');
}
lines.push('-- COMMIT; -- uncomment to commit automatically');

try {
  if (!fs.existsSync(path.join(ROOT, 'tmp'))) fs.mkdirSync(path.join(ROOT, 'tmp'));
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log('Wrote SQL to', outPath);
  process.exit(0);
} catch (e) {
  console.error('Failed to write SQL:', e.message);
  process.exit(2);
}

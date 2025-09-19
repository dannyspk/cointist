#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const mod = require('./generate-article-image.js');
async function main() {
  const selPath = path.join(process.cwd(), 'tmp', 'selection-to-pipeline.json');
  if (!fs.existsSync(selPath)) { console.error('selection file not found:', selPath); process.exit(2); }
  const j = JSON.parse(fs.readFileSync(selPath, 'utf8'));
  const items = Array.isArray(j.selected) ? j.selected : [];
  if (items.length === 0) { console.error('no selected items'); process.exit(2); }
  const it = items[0];
  try {
  const res = await mod.generateArticleImage(it, { model: 'gpt-image-1', response_format: 'b64_json', useResponses: true });
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('error:', e && e.message ? e.message : e);
    process.exit(1);
  }
}
main();

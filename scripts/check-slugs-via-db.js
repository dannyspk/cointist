#!/usr/bin/env node
// Script: check-slugs-via-db.js
// Purpose: Query src/lib/db directly for a list of slugs and print results.
const path = require('path');
const repoRoot = path.resolve(__dirname, '..');
const db = require(path.join(repoRoot, 'src', 'lib', 'db.js'));
(async () => {
  const sel = require(path.join(repoRoot, 'tmp', 'selection-from-pipeline.json'));
  if (!sel || !Array.isArray(sel.selected)) {
    console.error('No selection found'); process.exit(1);
  }
  for (const it of sel.selected) {
    const slug = it.slug;
    console.log('\nLookup slug:', slug);
    try {
      const row = await db.findArticleBySlug(slug);
      console.log(' DB row:', row ? { id: row.id, slug: row.slug, title: row.title || null } : null);
    } catch (e) {
      console.error(' DB error:', e && e.message ? e.message : e);
    }
  }
})();

#!/usr/bin/env node
"use strict";
const path = require('path');
const fs = require('fs');
const gen = require('./generate-article-image');

async function run() {
  const promptsPath = path.join(process.cwd(), 'tmp', 'generated-prompts-from-selection.json');
  if (!fs.existsSync(promptsPath)) {
    throw new Error('generated prompts file not found: ' + promptsPath);
  }
  const j = JSON.parse(fs.readFileSync(promptsPath, 'utf8'));
  const ids = [147, 148];
  for (const id of ids) {
    const item = (j.generated || []).find(x => x.id === id);
    if (!item) {
      console.error('No prompts found for id', id);
      continue;
    }
    const prompt = item.prompts && item.prompts.hero_editorial;
    if (!prompt) {
      console.error('No hero prompt for id', id);
      continue;
    }
    // build a minimal article object
    const article = { id: item.id, slug: item.slug, title: item.slug, summary: '' };
    try {
      console.log('Generating hero for', id, 'slug=', item.slug);
  const res = await gen.generateArticleImage(article, { prompt, model: 'gpt-image-1', response_format: 'b64_json', apiKey: process.env.OPENAI_API_KEY, useResponses: false });
      console.log('Saved image for', id, ':', res.outPath, 'via=', res.via);
    } catch (e) {
      console.error('Error for', id, e && e.message ? e.message : e);
    }
  }
}

if (require.main === module) {
  run().catch(err => { console.error(err && err.stack ? err.stack : err); process.exit(1); });
}

module.exports = { run };

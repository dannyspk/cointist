#!/usr/bin/env node
"use strict";
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS_DIR = path.join(process.cwd(), 'public', 'assets', 'opinions');
if (!fs.existsSync(ASSETS_DIR)) {
  console.error('Directory does not exist:', ASSETS_DIR);
  process.exit(1);
}

function safeName(title){
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-_.]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g,'-')
    .replace(/(^-|-$)/g,'')
}

async function processFile(file){
  const src = path.join(ASSETS_DIR, file);
  const ext = path.extname(file).toLowerCase();
  const base = path.basename(file, ext);
  const coverOut = path.join(ASSETS_DIR, `${base}-cover.jpg`);
  const thumbOut = path.join(ASSETS_DIR, `${base}-thumb.jpg`);

  try{
    // create cover: resize to max width 1200, preserve aspect, convert to jpeg
    await sharp(src).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 84 }).toFile(coverOut);
    // create thumbnail: 320x180 crop center
    await sharp(src).resize(320,180,{ fit: 'cover', position: 'centre' }).jpeg({ quality: 78 }).toFile(thumbOut);
    console.log('Processed', file, '->', path.basename(coverOut), path.basename(thumbOut));
  }catch(e){
    console.error('Failed processing', file, e.message || e);
  }
}

(async ()=>{
  console.log('Scanning', ASSETS_DIR);
  const files = fs.readdirSync(ASSETS_DIR).filter(f => /\.(jpe?g|png|webp)$/i.test(f));
  if (!files.length) { console.log('No image files found in', ASSETS_DIR); return; }
  for (const f of files){
    // skip files that already look like generated variants
    if (/-thumb\.|-cover\./.test(f)) continue;
    await processFile(f);
  }
  console.log('Done.');
})();

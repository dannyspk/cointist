#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const PATTERNS = ['**/*article*-1200w.*', '**/*-1200w.*']; // match article images that include 1200w suffix
const OUT_WIDTHS = [320, 480, 720, 900, 1200];

async function processFile(file) {
  try {
    const abs = path.join(ASSETS_DIR, file);
    const ext = path.extname(file).toLowerCase();
    const base = file.replace(/(-?1200w)?\.[^/.]+$/, '');
    const buffer = fs.readFileSync(abs);
    const img = sharp(buffer, { animated: false });
    const meta = await img.metadata();
    const origW = meta.width || 1200;
    for (const w of OUT_WIDTHS) {
      if (w > origW) continue; // don't upscale
      const outName = `${base}-${w}w.webp`;
      const outPath = path.join(ASSETS_DIR, outName);
      if (fs.existsSync(outPath)) {
        console.log('exists', outName);
        continue;
      }
      await img.resize(w).webp({ quality: 80 }).toFile(outPath);
      console.log('wrote', outName);
    }
  } catch (e) {
    console.error('failed', file, e && e.message);
  }
}

async function main() {
  const files = new Set();
  for (const pat of PATTERNS) {
    const matches = glob.sync(pat, { cwd: ASSETS_DIR, nodir: true });
    matches.forEach(m => files.add(m));
  }
  if (!files.size) {
    console.log('no matching images found in', ASSETS_DIR);
    return;
  }
  console.log('found', files.size, 'images');
  for (const f of files) {
    // normalize to forward slashes for paths
    await processFile(f.replace(/\\/g, '/'));
  }
}

main().catch(e=>{console.error(e);process.exit(1);});

#!/usr/bin/env node
/*
  Patch GCS object metadata for files under tmp/images using sharp to probe dimensions.
  Writes a results JSON to tmp/patch-gcs-metadata-results.json

  Usage: node scripts/patch-gcs-metadata.js
*/

const fs = require('fs');
const path = require('path');

(async function main(){
  try {
    const imagesDir = path.resolve(process.cwd(), 'tmp', 'images');
    if (!fs.existsSync(imagesDir)) {
      console.error('Images directory not found:', imagesDir);
      process.exit(2);
    }

    const files = fs.readdirSync(imagesDir).filter(f => f && !f.startsWith('.'));
    if (!files.length) {
      console.log('No files found in', imagesDir);
      return;
    }

  // import GCS helper (use file:// URL on Windows)
  const { pathToFileURL } = require('url');
  const storageMod = await import(pathToFileURL(path.join(process.cwd(), 'src', 'lib', 'storage-gcs.js')).href);
    const { getStorage } = storageMod;
    const bucketName = process.env.GCS_IMAGE_BUCKET || process.env.GCS_BUCKET;
    if (!bucketName) {
      console.error('GCS_IMAGE_BUCKET or GCS_BUCKET not set in env');
      process.exit(3);
    }

    const storage = getStorage();
    const bucket = storage.bucket(bucketName);

    const sharp = require('sharp');

    const results = [];
    for (const file of files) {
      const localPath = path.join(imagesDir, file);
      if (!fs.existsSync(localPath)) continue;
      const item = { file, ok: false, error: null, width: null, height: null };
      try {
        const meta = await sharp(localPath).metadata();
        const w = meta.width || null;
        const h = meta.height || null;
        item.width = w;
        item.height = h;

        if (w && h) {
          const gfile = bucket.file(file);
          // set custom metadata (preserve existing metadata key if present)
          const md = { metadata: { width: String(w), height: String(h) } };
          await gfile.setMetadata(md);
          item.ok = true;
          console.log(`Patched ${file} -> w=${w} h=${h}`);
        } else {
          item.error = 'sharp metadata missing width/height';
          console.warn(`No dims for ${file}`);
        }
      } catch (e) {
        item.error = e && e.message ? e.message : String(e);
        console.error(`Failed ${file}:`, item.error);
      }
      results.push(item);
    }

    const outDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'patch-gcs-metadata-results.json');
    fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
    console.log('Wrote', outPath);
    const failed = results.filter(r => !r.ok).length;
    console.log('Done. Patched:', results.length - failed, 'Failed:', failed);
    if (failed) process.exit(4);
  } catch (err) {
    console.error('Fatal', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();

#!/usr/bin/env node
/*
  Reupload images from tmp/images to the configured GCS bucket using
  src/lib/storage-gcs.js -> uploadFileToGcs. This will overwrite objects
  with the same destination name and attach width/height metadata for new uploads.

  Usage: node scripts/reupload-gcs-images.js
  Ensure GCS credentials and GCS_IMAGE_BUCKET (or GCS_BUCKET) are set in env.
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
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;
  const toUpload = typeof limit === 'number' && !isNaN(limit) ? files.slice(0, limit) : files;
    if (!files.length) {
      console.log('No files found in', imagesDir);
      return;
    }

  console.log('Found', files.length, 'files to upload from', imagesDir, limit ? `(processing first ${toUpload.length})` : '');

    const mod = await import(pathToFileURL(path.join(process.cwd(),'src','lib','storage-gcs.js')).href).catch(async (e) => {
      // fallback to relative import
      return await import('../src/lib/storage-gcs.js');
    });
    const uploadFileToGcs = mod.uploadFileToGcs;
    if (!uploadFileToGcs) {
      console.error('uploadFileToGcs not found in src/lib/storage-gcs.js');
      process.exit(3);
    }

    const results = [];
    let success = 0, failed = 0;
  for (const file of toUpload) {
      const localPath = path.join(imagesDir, file);
      if (!fs.existsSync(localPath)) continue;
      const item = { file, ok: false, error: null, url: null, width: null, height: null };
      try {
        process.stdout.write(`Uploading ${file} ... `);
        const res = await uploadFileToGcs(localPath, file, true);
        item.ok = true;
        item.url = res && res.url ? res.url : null;
        item.width = res && typeof res.width !== 'undefined' ? res.width : null;
        item.height = res && typeof res.height !== 'undefined' ? res.height : null;
        console.log('OK', item.url || '', `w=${item.width||'?'}`, `h=${item.height||'?'}`);
        success++;
      } catch (e) {
        item.ok = false;
        item.error = e && e.message ? e.message : String(e);
        console.error('ERROR', item.error);
        failed++;
      }
      results.push(item);
    }

    // ensure tmp directory exists
    const outDir = path.join(process.cwd(), 'tmp');
    try { if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true }); } catch (e) {}
    const outPath = path.join(outDir, 'reupload-gcs-results.json');
    try {
      fs.writeFileSync(outPath, JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
      console.log('\nWrote results to', outPath);
    } catch (e) {
      console.error('Failed to write results file', e && e.message ? e.message : e);
    }

    console.log('\nDone. Success:', success, 'Failed:', failed);
    if (failed) process.exit(4);
  } catch (err) {
    console.error('Fatal error', err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();

function pathToFileURL(p){
  // minimal implementation to avoid importing url module unnecessarily
  let resolved = path.resolve(p).replace(/\\/g, '/');
  if (!resolved.startsWith('/')) resolved = '/' + resolved;
  return { href: 'file://' + resolved };
}

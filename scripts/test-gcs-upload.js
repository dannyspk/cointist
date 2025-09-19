#!/usr/bin/env node
// CommonJS version
// Usage (PowerShell):
// $env:GCS_BUCKET='your-bucket' ; $env:GCS_PROJECT_ID='your-project' ; $env:GOOGLE_APPLICATION_CREDENTIALS='C:\path\to\key.json' ; node scripts/test-gcs-upload.js path/to/local/file.jpg

const path = require('path');
const fs = require('fs');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/test-gcs-upload.js <local-path> [destName]');
    process.exit(2);
  }
  const local = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(local)) {
    console.error('File not found:', local);
    process.exit(2);
  }
  const dest = args[1] || path.basename(local);
  try {
    // Try require; if that fails (ESM), use dynamic import
    let uploadFileToGcs;
    try {
      uploadFileToGcs = require('../src/lib/storage-gcs').uploadFileToGcs;
    } catch (e) {
      const mod = await import(pathToFileURL(path.resolve(__dirname, '..', 'src', 'lib', 'storage-gcs.js')).href);
      uploadFileToGcs = mod.uploadFileToGcs;
    }
  const res = await uploadFileToGcs(local, dest, true);
  const url = res && res.url ? res.url : res;
  const isPublic = res && typeof res.isPublic !== 'undefined' ? res.isPublic : null;
  console.log('Uploaded ->', url, 'public=', isPublic);
  } catch (e) {
    console.error('Upload failed:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

// helper to create file URL for dynamic import
function pathToFileURL(p) {
  let resolved = path.resolve(p).replace(/\\/g, '/');
  if (!resolved.startsWith('/')) resolved = '/' + resolved;
  return { href: 'file://' + resolved };
}

main();

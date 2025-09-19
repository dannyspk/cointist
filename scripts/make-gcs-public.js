#!/usr/bin/env node
// Make existing uploaded GCS objects public and update article DB records to public URLs.
// Usage (PowerShell):
// $env:GOOGLE_APPLICATION_CREDENTIALS='C:\path\to\key.json'; node scripts/make-gcs-public.js

const { getStorage } = require('../src/lib/storage-gcs');
const db = require('../src/lib/db');

async function main() {
  const storage = getStorage();
  const bucketName = process.env.GCS_BUCKET || process.env.GCS_IMAGE_BUCKET;
  if (!bucketName) {
    console.error('GCS_BUCKET or GCS_IMAGE_BUCKET env required');
    process.exit(2);
  }
  const bucket = storage.bucket(bucketName);

  // fetch all articles (careful in prod; this is simple and may be paginated later)
  let articles = [];
  try {
    articles = await db.findArticles({ take: 1000, includeGuides: true });
  } catch (e) {
    console.error('failed to fetch articles', e && e.message);
    process.exit(1);
  }

  for (const a of articles) {
    const updates = {};
    for (const field of ['coverImage','thumbnail']) {
      const val = a[field];
      if (!val) continue;
      // skip if already an absolute https URL
      if (String(val).startsWith('http://') || String(val).startsWith('https://')) continue;
      // assume val is a path relative to bucket, strip leading slash
      const objectPath = String(val).replace(/^\//, '');
      try {
        const file = bucket.file(objectPath);
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${encodeURIComponent(objectPath)}`;
        updates[field] = publicUrl;
        console.log(`Made public: ${objectPath} -> ${publicUrl}`);
      } catch (e) {
        console.error(`Failed to make public ${objectPath}:`, e && e.message);
      }
    }
    if (Object.keys(updates).length) {
      try {
        await db.updateArticle(a.id, updates);
        console.log(`Updated article ${a.id} with public URLs`);
      } catch (e) {
        console.error(`Failed to update article ${a.id}:`, e && e.message);
      }
    }
  }
}

main().catch(e=>{ console.error(e && e.message); process.exit(1); });

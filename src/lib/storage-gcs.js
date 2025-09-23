import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

const BUCKET = process.env.GCS_BUCKET;
const PROJECT_ID = process.env.GCS_PROJECT_ID;
const KEY_JSON = process.env.GCS_KEY_JSON ? JSON.parse(process.env.GCS_KEY_JSON) : undefined;
const KEY_PATH = process.env.GCS_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

// If a key path is provided and KEY_JSON not set, try to read it synchronously.
let KEY_JSON_FROM_PATH;
if (!KEY_JSON && KEY_PATH) {
  try {
    // expand leading ~ to the user's home directory in a safe way
    let resolved = KEY_PATH;
    if (resolved && resolved.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      resolved = home + resolved.slice(1);
    }
    resolved = path.resolve(resolved);
    const raw = fs.readFileSync(resolved, 'utf8');
    KEY_JSON_FROM_PATH = JSON.parse(raw);
  } catch (e) {
    // ignore: library may still use ADC via GOOGLE_APPLICATION_CREDENTIALS
    KEY_JSON_FROM_PATH = undefined;
  }
}

let storageClient;
export function getStorage() {
  if (storageClient) return storageClient;
  const opts = {};
  if (PROJECT_ID) opts.projectId = PROJECT_ID;
  if (KEY_JSON) opts.credentials = KEY_JSON;
  else if (KEY_JSON_FROM_PATH) opts.credentials = KEY_JSON_FROM_PATH;
  storageClient = new Storage(opts);
  return storageClient;
}

export async function uploadFileToGcs(localPath, destName, makePublic = true, bucketName) {
  const bucketToUse = bucketName || process.env.GCS_IMAGE_BUCKET || BUCKET;
  if (!bucketToUse) throw new Error('GCS_BUCKET not configured; uploads require a configured GCS bucket');

  const storage = getStorage();
  const bucket = storage.bucket(bucketToUse);
  const dest = destName || path.basename(localPath);

  // determine a sensible content type for images
  let contentType;
  try {
    const ext = (path.extname(dest) || '').toLowerCase();
    const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif' };
    contentType = map[ext];
  } catch (e) { contentType = undefined; }

  // try to probe local image dimensions if available (best-effort)
  let probed = { width: undefined, height: undefined };
  try {
    // only probe when a localPath exists on disk
    if (localPath && fs.existsSync(localPath)) {
      try {
        const sizeOf = require('image-size');
        const dims = sizeOf(localPath);
        if (dims && dims.width && dims.height) {
          probed.width = dims.width;
          probed.height = dims.height;
        }
      } catch (e) {
        // ignore probing failures; best-effort
      }
    }
  } catch (e) {
    // ignore
  }

  // sharp fallback: some WebP variants or container types are better probed with sharp
  try {
    if ((!probed.width || !probed.height) && localPath && fs.existsSync(localPath)) {
      try {
        const _sharp = require('sharp');
        const meta = await _sharp(localPath).metadata();
        if (meta && meta.width && meta.height) {
          probed.width = probed.width || meta.width;
          probed.height = probed.height || meta.height;
        }
      } catch (e) {
        // ignore sharp probing failure; still best-effort
      }
    }
  } catch (e) {
    // ignore
  }

  const uploadOpts = { destination: dest, resumable: false };
  // set long-lived immutable caching for uploaded image assets to improve repeat visit performance
  const defaultCache = 'public, max-age=31536000, immutable';
  // Attach probed dimensions as custom metadata (strings) when present
  const customMeta = {};
  if (probed.width) customMeta.width = String(probed.width);
  if (probed.height) customMeta.height = String(probed.height);
  if (contentType) uploadOpts.metadata = { contentType, cacheControl: defaultCache, metadata: Object.keys(customMeta).length ? customMeta : undefined };
  else uploadOpts.metadata = { cacheControl: defaultCache, metadata: Object.keys(customMeta).length ? customMeta : undefined };

  // retry on transient errors
  const maxAttempts = 3;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await bucket.upload(localPath, uploadOpts);
      const file = bucket.file(dest);
      if (makePublic) {
        try {
          await file.makePublic();
      return { url: `https://storage.googleapis.com/${bucketToUse}/${encodeURIComponent(dest)}`, isPublic: true, width: probed.width, height: probed.height };
        } catch (e) {
          // fallback to signed URL
          const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600 * 1000 });
      return { url, isPublic: false, width: probed.width, height: probed.height };
        }
      }
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 3600 * 1000 });
    return { url, isPublic: false, width: probed.width, height: probed.height };
    } catch (e) {
      lastErr = e;
      // simple transient detection: retry on network / 5xx / 429
      const code = e && (e.code || e.statusCode || (e.response && e.response.status));
      const shouldRetry = !code || (typeof code === 'number' ? (code >= 500 || code === 429) : String(code).startsWith('5'));
      if (attempt < maxAttempts && shouldRetry) {
        const ms = 200 * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, ms));
        continue;
      }
      // final failure -> surface the error
      throw lastErr || e;
    }
  }
  throw lastErr || new Error('upload failed');
}

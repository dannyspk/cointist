import { getStorage } from '../../../src/lib/storage-gcs';

export default async function handler(req, res) {
  // simple guard: optional token match to avoid open endpoint in some dev setups
  const secret = process.env.GCS_SIGN_TOKEN;
  const provided = req.headers['x-gcs-sign-token'] || req.query.token;
  if (secret && provided !== secret) return res.status(401).json({ error: 'unauthorized' });

  const { path: objectPath } = req.query || {};
  if (!objectPath) return res.status(400).json({ error: 'missing path query' });

  try {
    const storage = getStorage();
    const bucket = storage.bucket(process.env.GCS_BUCKET || process.env.GCS_IMAGE_BUCKET);
    if (!bucket) return res.status(500).json({ error: 'GCS bucket not configured' });
    const file = bucket.file(String(objectPath));
    const expires = Date.now() + 60 * 60 * 1000;
    const [url] = await file.getSignedUrl({ action: 'read', expires });
    return res.status(200).json({ url, expiresAt: new Date(expires).toISOString() });
  } catch (e) {
    console.error('gcs signed url error', e && e.message);
    return res.status(500).json({ error: 'failed to generate signed url' });
  }
}

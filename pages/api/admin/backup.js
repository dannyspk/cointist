import fs from 'fs';
import path from 'path';
import { requireAdmin } from '../../../src/lib/auth';
import { uploadFileToGcs } from '../../../src/lib/storage-gcs';

export default async function handler(req, res) {
  // top-level error handling to capture unexpected runtime errors and help debug from the UI
  const LOG_DIR = path.resolve(process.cwd(), 'logs');
  const LOG_FILE = path.join(LOG_DIR, 'backup-errors.log');
  try {
    // ensure we record the incoming request for debugging
    try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR); fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] handler called\n`); } catch (_) {}
    if (!requireAdmin(req, res)) return;
    const db = path.resolve(process.cwd(), 'prisma', 'dev.db');
    const backups = path.resolve(process.cwd(), 'backups');
    if (!fs.existsSync(backups)) fs.mkdirSync(backups);
    const dest = path.join(backups, `dev-backup-${Date.now()}.db`);
    try {
      fs.copyFileSync(db, dest);
      // If STORAGE_PROVIDER is explicitly 'gcs' or a GCS_BUCKET is present, upload to GCS
      if (process.env.STORAGE_PROVIDER === 'gcs' || process.env.GCS_BUCKET) {
        try {
          const gcsName = `backups/${path.basename(dest)}`;
          const uploadRes = await uploadFileToGcs(dest, gcsName, false);
          const url = uploadRes && uploadRes.url ? uploadRes.url : (typeof uploadRes === 'string' ? uploadRes : undefined);
          // optionally remove local copy unless caller asked to keep it
          if (process.env.GCS_KEEP_LOCAL !== 'true') {
            try { fs.unlinkSync(dest); } catch (e) {}
          }
          // make storage.googleapis.com paths more readable by decoding the object path
          let outUrl = url;
          const prefix = 'https://storage.googleapis.com/';
          try {
            if (typeof outUrl === 'string' && outUrl.startsWith(prefix)) {
              const rest = outUrl.slice(prefix.length);
              outUrl = prefix + decodeURIComponent(rest);
            }
          } catch (e) {
            outUrl = url;
          }
          console.log('[admin/backup] uploaded backup ->', outUrl);
          return res.json({ ok: true, file: outUrl });
        } catch (e) {
          const entry = `[${new Date().toISOString()}] upload error: ${String(e && e.message ? e.message : e)}\n${e && e.stack ? e.stack : ''}\n`;
          try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR); fs.appendFileSync(LOG_FILE, entry); } catch (_) {}
          console.error('[admin/backup] gcs upload failed:', e && e.message ? e.message : e);
          return res.status(500).json({ error: 'backup upload failed', detail: String(e && e.message ? e.message : e) });
        }
      }
      return res.json({ ok: true, file: dest });
    } catch (e) {
      const entry = `[${new Date().toISOString()}] backup error: ${String(e && e.message ? e.message : e)}\n${e && e.stack ? e.stack : ''}\n`;
      try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR); fs.appendFileSync(LOG_FILE, entry); } catch (_) {}
      return res.status(500).json({ error: String(e && e.message ? e.message : e) });
    }
  } catch (e) {
    const entry = `[${new Date().toISOString()}] handler error: ${String(e && e.message ? e.message : e)}\n${e && e.stack ? e.stack : ''}\n`;
    try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR); fs.appendFileSync(LOG_FILE, entry); } catch (_) {}
    return res.status(500).json({ error: String(e && e.message ? e.message : e), stack: e && e.stack ? e.stack : undefined });
  }
}

import fs from 'fs';
import path from 'path';
import sizeOf from 'image-size';
import { requireAdmin } from '../../../src/lib/auth';
import { uploadFileToGcs } from '../../../src/lib/storage-gcs';

export const config = { api: { bodyParser: false } };

async function loadSharp() {
  try { const mod = await import('sharp'); return mod.default || mod; } catch (e) { return null; }
}

function trimAfterWebp(u) {
  try {
    if (!u || typeof u !== 'string') return u;
    const idx = u.indexOf('.webp');
    if (idx === -1) return u;
    // include .webp (4 chars) and strip everything after
    return u.slice(0, idx + 5);
  } catch (e) { return u; }
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('[admin/upload] incoming Content-Type:', req.headers['content-type']);
      const hdrs = { 'content-type': req.headers['content-type'], 'x-cms-password': req.headers['x-cms-password'] };
      console.log('[admin/upload] headers summary:', hdrs);
    } catch (e) {}
  }

  if (req.method !== 'POST') { res.setHeader('Allow', ['POST']); return res.status(405).end(`Method ${req.method} Not Allowed`); }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const contentType = String(req.headers['content-type'] || '');

  // Multipart/form-data via busboy
  if (contentType.includes('multipart/form-data')) {
    let BusboyMod = null;
    try { BusboyMod = await import('busboy'); } catch (e) { BusboyMod = null; }
    if (!BusboyMod && typeof globalThis.require === 'function') { try { BusboyMod = globalThis.require('busboy'); } catch (e) { BusboyMod = null; } }

    let BusboyCtor = null;
    if (typeof BusboyMod === 'function') BusboyCtor = BusboyMod;
    else if (BusboyMod && typeof BusboyMod.default === 'function') BusboyCtor = BusboyMod.default;
    else if (BusboyMod && typeof BusboyMod.Busboy === 'function') BusboyCtor = BusboyMod.Busboy;

    if (!BusboyCtor) {
      const msg = 'server missing busboy';
      if (process.env.NODE_ENV !== 'production') return res.status(500).json({ error: msg, busboyType: typeof BusboyMod, busboyKeys: BusboyMod && typeof BusboyMod === 'object' ? Object.keys(BusboyMod).slice(0,20) : undefined });
      return res.status(500).json({ error: msg });
    }

    const bb = new BusboyCtor({ headers: req.headers });
    const tasks = [];
    let invalidType = null;

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info || {};
      if (!mimeType || !mimeType.startsWith('image/')) { invalidType = 'type'; fileStream.resume(); return; }
      const tmpName = `${Date.now()}-tmp-${(filename || 'file').replace(/\s+/g, '-')}`;
      const tmpPath = path.join(uploadsDir, tmpName);
      const out = fs.createWriteStream(tmpPath);
      let total = 0;

      const p = new Promise((resolve) => {
        fileStream.on('data', (c) => { total += c.length; if (total > 10 * 1024 * 1024) { try { fileStream.unpipe(out); } catch (e) {} try { out.destroy(); } catch (e) {} } });
        fileStream.pipe(out);
        out.on('finish', async () => {
          try {
            const stats = fs.statSync(tmpPath);
            if (stats.size > 10 * 1024 * 1024) { try { fs.unlinkSync(tmpPath); } catch (e) {} ; invalidType = 'size'; return resolve({ error: 'size' }); }
            let dims;
            try { dims = sizeOf(tmpPath); } catch (e) { try { fs.unlinkSync(tmpPath); } catch (er) {}; invalidType = 'dims'; return resolve({ error: 'dims' }); }
            if (dims.width > 4096 || dims.height > 4096) { try { fs.unlinkSync(tmpPath); } catch (e) {}; invalidType = 'dims'; return resolve({ error: 'dims' }); }

            const safe = `${Date.now()}-${(filename || 'file').replace(/\s+/g, '-')}`;
            const dest = path.join(uploadsDir, safe);
            const target = (req.query && req.query.target) ? String(req.query.target) : '';
            try {
              const _sharp = await loadSharp();
              if (_sharp) {
                if (target === 'thumbnail') await _sharp(tmpPath).resize({ width: 320, height: 180, fit: 'inside', withoutEnlargement: true }).toFile(dest);
                else await _sharp(tmpPath).resize({ width: 720, height: 560, fit: 'inside', withoutEnlargement: true }).toFile(dest);
                try { fs.unlinkSync(tmpPath); } catch (e) {}
                try {
                  const parsed = path.parse(dest);
                  const webpName = `${parsed.name}.webp`;
                  const webpDest = path.join(uploadsDir, webpName);
                  await _sharp(dest).toFormat('webp').toFile(webpDest);
                  try { fs.unlinkSync(dest); } catch (e) {}
                  return resolve({ filename: webpName, dest: webpDest });
                } catch (e) { return resolve({ filename: safe, dest }); }
              } else {
                try { fs.renameSync(tmpPath, dest); } catch (e) { try { fs.writeFileSync(dest, fs.readFileSync(tmpPath)); fs.unlinkSync(tmpPath); } catch (ee) {} }
                return resolve({ filename: safe, dest });
              }
            } catch (err) {
              try { fs.renameSync(tmpPath, dest); } catch (e) { try { fs.writeFileSync(dest, fs.readFileSync(tmpPath)); fs.unlinkSync(tmpPath); } catch (ee) {} }
              return resolve({ filename: safe, dest });
            }
          } catch (err) {
            try { fs.unlinkSync(tmpPath); } catch (e) {}
            invalidType = 'error';
            return resolve({ error: 'error' });
          }
        });
        out.on('error', () => { try { fs.unlinkSync(tmpPath); } catch (e) {} ; invalidType = 'error'; return resolve({ error: 'error' }); });
      });
      tasks.push(p);
    });

    bb.on('close', async () => {
      const results = await Promise.all(tasks);
      if (invalidType === 'size') return res.status(413).json({ error: 'file too large (max 10MB)' });
      if (invalidType === 'dims') return res.status(422).json({ error: 'image dimensions exceed 4096x4096' });
      if (invalidType === 'type') return res.status(415).json({ error: 'only image uploads allowed' });
      const saved = results.find(r => r && r.filename);
      if (!saved) return res.status(400).json({ error: 'no file uploaded or failed processing' });
      let url = `/uploads/${saved.filename}`;

      if (process.env.STORAGE_PROVIDER === 'gcs' || process.env.GCS_BUCKET) {
        try {
          const gcsPath = `uploads/${saved.filename}`;
          const imagesBucket = process.env.GCS_IMAGE_BUCKET || 'cointist-images';
          const gcsRes = await uploadFileToGcs(saved.dest, gcsPath, true, imagesBucket);
          if (process.env.GCS_KEEP_LOCAL !== 'true') { try { fs.unlinkSync(saved.dest); } catch (e) {} }
          url = gcsRes && gcsRes.url ? trimAfterWebp(gcsRes.url) : url;
          try { console.log('[admin/upload] image uploaded ->', url, 'public=', !!(gcsRes && gcsRes.isPublic)); } catch (e) {}
        } catch (e) { console.error('[admin/upload] gcs upload failed:', e && e.message ? e.message : e); return res.status(500).json({ error: 'gcs upload failed', detail: String(e && e.message ? e.message : e) }); }
      }

      return res.status(201).json({ url, path: saved.dest });
    });

    req.pipe(bb);
    return;
  }

  // JSON/base64 fallback
  let body = '';
  for await (const chunk of req) body += chunk;
  try {
    const parsed = JSON.parse(body || '{}');
    const { name, data } = parsed;
    if (!name || !data) return res.status(400).json({ error: 'name and data (base64) required' });
    const ext = path.extname(name || '').toLowerCase();
    const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'];
    if (!allowed.includes(ext)) return res.status(415).json({ error: 'only image uploads allowed' });
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 10 * 1024 * 1024) return res.status(413).json({ error: 'file too large (max 10MB)' });
    try { const dims = sizeOf(buf); if (dims.width > 4096 || dims.height > 4096) return res.status(422).json({ error: 'image dimensions exceed 4096x4096' }); } catch (e) { return res.status(415).json({ error: 'invalid image file' }); }

    const safeName = `${Date.now()}-${name}`.replace(/\s+/g, '-');
    let dest = path.join(uploadsDir, safeName);
    try { const _sharp = await loadSharp(); if (_sharp) await _sharp(buf).resize({ width: 720, height: 560, fit: 'inside', withoutEnlargement: true }).toFile(dest); else fs.writeFileSync(dest, buf); } catch (e) { fs.writeFileSync(dest, buf); }

    let urlPath = '';
    try {
      const _sharp2 = await loadSharp();
      if (_sharp2) {
        const parsedP = path.parse(dest);
        const webpName = `${parsedP.name}.webp`;
        const webpDest = path.join(uploadsDir, webpName);
        try { await _sharp2(dest).toFormat('webp').toFile(webpDest); try { fs.unlinkSync(dest); } catch (e) {} dest = webpDest; urlPath = `/uploads/${webpName}`; } catch (e) { urlPath = `/uploads/${safeName}`; }
      } else { urlPath = `/uploads/${safeName}`; }
    } catch (e) { urlPath = `/uploads/${safeName}`; }

    if (!urlPath) urlPath = `/uploads/${safeName}`;
    if (process.env.STORAGE_PROVIDER === 'gcs' || process.env.GCS_BUCKET) {
      try {
        const gcsPath = `uploads/${path.basename(dest)}`;
        const imagesBucket = process.env.GCS_IMAGE_BUCKET || 'cointist-images';
        const gcsRes = await uploadFileToGcs(dest, gcsPath, true, imagesBucket);
        if (process.env.GCS_KEEP_LOCAL !== 'true') { try { fs.unlinkSync(dest); } catch (e) {} }
                urlPath = gcsRes && gcsRes.url ? trimAfterWebp(gcsRes.url) : urlPath;
        try { console.log('[admin/upload] image uploaded ->', urlPath, 'public=', !!(gcsRes && gcsRes.isPublic)); } catch (e) {}
      } catch (e) { /* ignore and return local path */ }
    }
    return res.status(201).json({ url: urlPath, path: dest });
  } catch (e) {
    try {
      console.error('[admin/upload] invalid JSON body; headers:', req.headers);
      const preview = (body && String(body).slice(0, 1024)) || '<empty>';
      console.error('[admin/upload] body preview:', preview);
    } catch (logErr) {
      console.error('[admin/upload] failed to log invalid body', logErr);
    }
    const resp = { error: 'invalid body' };
    if (process.env.NODE_ENV !== 'production') {
      resp.detail = (body && String(body).slice(0, 200)) || null;
      try { resp.headers = req.headers; } catch (e) { /* ignore */ }
    }
    return res.status(400).json(resp);
  }
}

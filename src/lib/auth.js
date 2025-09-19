import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const CMS_FILE = path.resolve(process.cwd(), '.cms.json');

function hashPassword(password, salt) {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString('hex');
}

export function checkAdminAuth(req) {
  // 1) JWT cookie (preferred)
  try {
    if (req.headers.cookie) {
      const cookie = req.headers.cookie.split(';').map(c=>c.trim()).find(c=>c.startsWith('cms_token='));
      if (cookie) {
        const token = cookie.split('=')[1];
        if (fs.existsSync(CMS_FILE)) {
          const raw = fs.readFileSync(CMS_FILE, 'utf8');
          const cfg = JSON.parse(raw);
          if (cfg.jwtSecret) {
            try {
              const decoded = jwt.verify(token, cfg.jwtSecret);
              if (decoded && decoded.user) return { ok: true };
            } catch (e) {
              // invalid token -> fallthrough to other checks
            }
          }
        }
      }
    }
  } catch (e) {
    // ignore and continue to header/file-based fallback
  }

  // 2) ENV header shortcut (legacy) — when present, require matching header
  const header = req.headers['x-cms-password'] || req.headers['x-cms-pass'];
  const env = process.env.CMS_PASSWORD || process.env.NEXT_PUBLIC_CMS_PASSWORD;
  if (env) {
    if (!header) return { ok: false, reason: 'missing password header' };
    if (header !== env) return { ok: false, reason: 'invalid password' };
    return { ok: true };
  }

  // 3) fallback: on-disk password file + header matching (legacy behavior)
  if (!fs.existsSync(CMS_FILE)) return { ok: false, reason: 'CMS not set up' };
  if (!header) return { ok: false, reason: 'missing password header' };
  try {
    const raw = fs.readFileSync(CMS_FILE, 'utf8');
    const { salt, hash } = JSON.parse(raw);
    const candidate = hashPassword(header, salt);
    if (candidate !== hash) return { ok: false, reason: 'invalid password' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'auth error' };
  }
}

export function requireAdmin(req, res) {
  const r = checkAdminAuth(req);
  if (!r.ok) {
  // Don't send a WWW-Authenticate header (browser will show a native username/password prompt).
  // Return a plain 401 JSON response instead so clients can handle auth in-app.
  res.status(401).json({ error: r.reason });
    return false;
  }
  return true;
}

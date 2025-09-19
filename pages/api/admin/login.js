import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

function hashPassword(password, salt) {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString('hex');
}

const CMS_FILE = path.resolve(process.cwd(), '.cms.json');

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');
  if (!fs.existsSync(CMS_FILE)) return res.status(400).json({ error: 'CMS not set up' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const raw = fs.readFileSync(CMS_FILE, 'utf8');
    const cfg = JSON.parse(raw);
    if (cfg.username !== username) return res.status(401).json({ error: 'invalid credentials' });
    const candidate = hashPassword(password, cfg.salt);
    if (candidate !== cfg.hash) return res.status(401).json({ error: 'invalid credentials' });
  // shorten token lifetime to 4 hours for better security
  const token = jwt.sign({ user: username }, cfg.jwtSecret, { expiresIn: '4h' });
  // set httpOnly cookie. Mark Secure in production.
  const maxAge = 4 * 60 * 60; // 4 hours
  const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure; ' : '';
  // Keep SameSite=Lax to preserve reasonable cross-origin UX for some embed flows
  res.setHeader('Set-Cookie', `cms_token=${token}; HttpOnly; ${secureFlag}Path=/; Max-Age=${maxAge}; SameSite=Lax`);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

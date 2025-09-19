import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CMS_FILE = path.resolve(process.cwd(), '.cms.json');

function hashPassword(password, salt) {
  const key = crypto.scryptSync(password, salt, 64);
  return key.toString('hex');
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    const exists = fs.existsSync(CMS_FILE);
    return res.json({ setupNeeded: !exists });
  }

  if (req.method === 'POST') {
    // One-time creation only
    if (fs.existsSync(CMS_FILE)) return res.status(400).json({ error: 'Setup already completed' });
    const { username, password } = req.body || {};
    if (!username || typeof username !== 'string' || username.length < 1) return res.status(400).json({ error: 'username required' });
    if (!password || typeof password !== 'string' || password.length < 6) return res.status(400).json({ error: 'password must be a string (min 6 chars)' });
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const payload = { salt, hash, username, jwtSecret, createdAt: new Date().toISOString() };
    try {
      fs.writeFileSync(CMS_FILE, JSON.stringify(payload, null, 2), { mode: 0o600 });
      return res.status(201).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.setHeader('Allow', ['GET','POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

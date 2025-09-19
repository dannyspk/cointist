import fs from 'fs';
import path from 'path';
import { checkAdminAuth } from '../../../src/lib/auth';

const ENV_FILE = path.resolve(process.cwd(), '.env.local');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // verify provided header/password
  const r = checkAdminAuth(req);
  if (!r.ok) return res.status(401).json({ error: r.reason });

  // we accept optional explicit password in body, otherwise requireAdmin used header
  const { password } = req.body || {};
  const pass = password || req.headers['x-cms-password'] || req.headers['x-cms-pass'];
  if (!pass) return res.status(400).json({ error: 'password required' });

  try {
    const content = `CMS_PASSWORD=${pass}`;
    fs.writeFileSync(ENV_FILE, content, { encoding: 'utf8', mode: 0o600 });
    return res.json({ ok: true, path: ENV_FILE });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

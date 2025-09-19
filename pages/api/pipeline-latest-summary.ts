import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const q = req.query || {};
    const since = q.since ? parseInt(String(q.since), 10) : 0;
    const dir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(dir)) return res.status(200).json({ ok: true, found: false });
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('pipeline-summary-') && f.endsWith('.json'))
      .map(f => ({ f, p: path.join(dir, f), m: fs.statSync(path.join(dir, f)).mtimeMs }))
      .filter(x => x.m > since)
      .sort((a,b) => b.m - a.m);
    if (!files || files.length === 0) return res.status(200).json({ ok: true, found: false });
    const newest = files[0];
    // attempt to read the file; if it fails JSON.parse we return found:false so the UI can retry
    try {
      const raw = fs.readFileSync(newest.p, 'utf8');
      const parsed = JSON.parse(raw);
      return res.status(200).json({ ok: true, found: true, path: newest.p, mtime: newest.m, summary: parsed });
    } catch (e) {
      return res.status(200).json({ ok: true, found: false, reason: 'parse-error', detail: String(e), path: newest.p, mtime: newest.m });
    }
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

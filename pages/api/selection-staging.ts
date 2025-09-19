import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const body = req.body || {};
    const selected = Array.isArray(body?.selected) ? body.selected : (Array.isArray(body?.items) ? body.items : []);
    if (!Array.isArray(selected)) {
      res.status(400).json({ error: 'Invalid payload: expected selected array' });
      return;
    }
    const out = { selected, stagedAt: new Date().toISOString() };
    const tmpDir = path.join(process.cwd(), 'tmp');
    const outfile = path.join(tmpDir, 'selection-from-pipeline.json');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch {}
    fs.writeFileSync(outfile, JSON.stringify(out, null, 2), 'utf8');
    res.status(200).json({ ok: true, path: outfile, count: selected.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // prevent caching
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    const TMP = path.join(process.cwd(), 'tmp');
    // prefer the streaming capture file; fall back to the older pipeline-run.log
    const preferred = path.join(TMP, 'pipeline-run-output.txt');
    const fallback = path.join(TMP, 'pipeline-run.log');
    let logFile = preferred;
    if (!fs.existsSync(logFile)) {
      logFile = fallback;
      if (!fs.existsSync(logFile)) return res.status(200).json({ ok: true, exists: false, lines: [] });
    }
    const stat = fs.statSync(logFile);
    const mtime = stat.mtimeMs || 0;
  // if caller provided since, indicate whether the log file changed since that timestamp
  const since = req.query.since ? Number(req.query.since) : 0;
  const changedSince = Boolean(since && mtime > since);
  const raw = fs.readFileSync(logFile, 'utf8');
    const all = String(raw || '').split(/\r?\n/);
    const q = req.query.lines ? Number(req.query.lines) : 40;
    const lines = all.slice(Math.max(0, all.length - (isNaN(q) ? 40 : q)));
  return res.status(200).json({ ok: true, exists: true, lines, mtime, path: logFile, changedSince });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

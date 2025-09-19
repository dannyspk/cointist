import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
  // prevent browser or intermediate caching — callers expect fresh results
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
    const TMP = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(TMP)) return res.status(200).json({ ok: true, found: false, message: 'no tmp folder' });
    const files = fs.readdirSync(TMP).filter(f => f.startsWith('pipeline-summary-') && f.endsWith('.json'));

    // First, try to find a run-completion sentinel in known logs that references
    // the final summary for the most recent run. If found and the referenced
    // summary file exists, return it directly (this limits results to the
    // most-recent run).
    const tryLogs = ['pipeline-run-output.txt', 'pipeline-run.log', 'pipeline-run-output-2.txt'];
    let finalSummaryPath: string | null = null;
    for (const lf of tryLogs) {
      const lfPath = path.join(TMP, lf);
      if (!fs.existsSync(lfPath)) continue;
      try {
        const txt = fs.readFileSync(lfPath, 'utf8');
        // find the last occurrence (if multiple runs recorded)
        const matches = Array.from(txt.matchAll(/Run complete, summary written to ([^\r\n]+)/g));
        if (matches && matches.length) {
          finalSummaryPath = matches[matches.length - 1][1].trim();
          break;
        }
      } catch (e) {
        // ignore and continue to next log
      }
    }
  // If the logs reference a final summary, record it as the run's final
  // marker. We'll use the final summary's embedded timestamp later to bound
  // which pipeline-summary files belong to the same run (so we can return
  // all summaries from that run, not only a single file).
  let finalSummaryPathResolved: string | null = null;
    if (finalSummaryPath) {
      const candidates = [finalSummaryPath, path.join(TMP, path.basename(finalSummaryPath))];
      for (const cand of candidates) {
        if (!cand) continue;
        try {
          if (fs.existsSync(cand)) {
            finalSummaryPathResolved = cand;
            break;
          }
        } catch (e) {
          // ignore
        }
      }
      // If no candidate file exists, we'll fall back to invocation-time filtering
      // below.
    }

    if (!files || files.length === 0) {
      return res.status(200).json({ ok: true, found: false, files: [] });
    }
    // Aggregate all pipeline-summary-*.json files into a combined summary
    // This handles pipelines that may write one summary per item. We read all files,
    // merge items, dedupe by slug/id, and return a combined summary. Respect the
    // optional 'since' query parameter: if the newest summary mtime is <= since,
    // report no new summary.
    files.sort();
    const summaries: Array<{ file: string; full: string; mtime: number; json: any }> = [];
  for (const f of files) {
      const full = path.join(TMP, f);
      try {
        const raw = fs.readFileSync(full, 'utf8');
        const j = JSON.parse(raw);
        const mtime = fs.statSync(full).mtimeMs || 0;
        summaries.push({ file: f, full, mtime, json: j });
      } catch (e) {
        // ignore parse/read errors for individual files and continue
        continue;
      }
    }
    if (summaries.length === 0) return res.status(200).json({ ok: true, found: false, files: [] });
    // newest mtime across summary files
    const latestMtime = summaries.reduce((m, s) => Math.max(m, s.mtime || 0), 0);
    const since = req.query.since ? Number(req.query.since) : 0;
    if (since && latestMtime <= since) return res.status(200).json({ ok: true, found: false, message: 'no new summary', mtime: latestMtime });

    // Narrow summaries to the most recent run by filename timestamps.
    // Strategy:
    // 1. Prefer the final summary referenced in run logs (finalSummaryPathResolved).
    // 2. Compute a time-window (configurable via PIPELINE_WINDOW_MS) before that final
    //    timestamp and include all pipeline-summary files whose filename timestamps
    //    fall within that window up to the final summary.
    // 3. If no final summary is available, use the latest summary file timestamp
    //    and include files within the same window before it.
    const parseTsFromName = (name: string) => {
      const m = String(name || '').match(/-(\d+)\.json$/);
      return m ? Number(m[1]) : 0;
    };

    const envWindow = Number(process.env.PIPELINE_WINDOW_MS || 0) || 1000 * 60 * 2; // default 2 minutes
    let finalTs = 0;
    if (finalSummaryPathResolved) finalTs = parseTsFromName(path.basename(finalSummaryPathResolved)) || 0;
    const latestFileTs = summaries.reduce((mx, s) => Math.max(mx, parseTsFromName(s.file) || 0), 0);
    const windowMs = envWindow;
    const upperTs = finalTs || latestFileTs;
    const lowerTs = Math.max(0, (finalTs ? finalTs : latestFileTs) - windowMs);

    const filtered = summaries.filter(s => {
      const ts = parseTsFromName(s.file) || 0;
      return ts >= lowerTs && ts <= upperTs;
    });

    if (filtered.length > 0) {
      summaries.length = 0;
      for (const s of filtered) summaries.push(s);
    }

    // recompute newest mtime across the (possibly filtered) summary files
    const recomputedLatestMtime = summaries.reduce((m, s) => Math.max(m, s.mtime || 0), 0);
    const since2 = req.query.since ? Number(req.query.since) : 0;
    if (since2 && recomputedLatestMtime <= since2) return res.status(200).json({ ok: true, found: false, message: 'no new summary', mtime: recomputedLatestMtime });

    // Merge items, dedupe by slug (preferred) or id
    const seen = new Set<string>();
    const combinedItems: any[] = [];
    for (const s of summaries) {
      const data = s.json;
      if (!data) continue;
      const items = Array.isArray(data.items) ? data.items : (data.item ? [data.item] : []);
      for (const it of items) {
        if (!it) continue;
        const key = (it.slug ? `s:${String(it.slug)}` : '') || (it.id ? `i:${String(it.id)}` : '') || (it.url ? `u:${String(it.url)}` : JSON.stringify(it));
        if (seen.has(key)) continue;
        seen.add(key);
        combinedItems.push(it);
      }
    }

    const combined = { count: combinedItems.length, items: combinedItems, createdAt: new Date().toISOString() };
    return res.status(200).json({ ok: true, found: true, fileCount: summaries.length, mtime: latestMtime, summary: combined, finished: true });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

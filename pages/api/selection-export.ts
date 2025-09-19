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
    // Normalize payload: expect { selected: [...] }
    const selected = Array.isArray(body?.selected) ? body.selected : (Array.isArray(body?.items) ? body.items : []);
    if (!Array.isArray(selected)) {
      res.status(400).json({ error: 'Invalid payload: expected selected array' });
      return;
    }
    // Validate that every item has a numeric DB id — write only after upsert is complete
    // Accept numeric strings (e.g. "274") by coercing them to numbers before validation.
    const invalid: number[] = [];
    for (let i = 0; i < selected.length; i++) {
      const it: any = selected[i] || {};
      // coerce numeric-like string ids to numbers
      if (typeof it.id === 'string') {
        const trimmed = it.id.trim();
        if (/^[0-9]+$/.test(trimmed)) {
          it.id = Number(trimmed);
        }
      }
      const id = it.id;
      if (!(typeof id === 'number' && Number.isFinite(id))) invalid.push(i);
    }

  // If some ids are missing, do NOT attempt slug/title DB lookups — instead run the populate script
  // which parses pipeline logs/upsert artifacts to populate numeric ids, then reload mappings.
  if (invalid.length) {
      try {
        const { spawnSync } = await import('child_process');
        const repoRoot = process.cwd();
        const script = path.join(repoRoot, 'scripts', 'populate-ids-from-log.js');
        if (fs.existsSync(script)) {
          // run script synchronously and ignore output; it's best-effort
          try {
            spawnSync(process.execPath, [script], { cwd: repoRoot, stdio: 'ignore', timeout: 30 * 1000 });
            // reload tmp/selection-from-pipeline.json if present and update selected ids by matching slug
            const tmpDir = path.join(process.cwd(), 'tmp');
            const selFile = path.join(tmpDir, 'selection-from-pipeline.json');
            if (fs.existsSync(selFile)) {
              try {
                const raw = fs.readFileSync(selFile, 'utf8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed.selected)) {
                  const map: Record<string, number> = {};
                  for (const s of parsed.selected) {
                    if (s && s.slug && (typeof s.id === 'number' || (typeof s.id === 'string' && /^[0-9]+$/.test(String(s.id).trim())))) {
                      map[String(s.slug)] = Number(s.id);
                    }
                  }
                  for (const idx of [...invalid]) {
                    const it: any = selected[idx] || {};
                    const slug = String(it.slug || '').trim();
                    if (slug && typeof map[slug] !== 'undefined') {
                      selected[idx].id = Number(map[slug]);
                      const pos = invalid.indexOf(idx);
                      if (pos !== -1) invalid.splice(pos, 1);
                    }
                  }
                }
              } catch (e) { /* ignore reload errors */ }
            }
          } catch (e) { /* ignore spawn errors */ }
        }
      } catch (e) { /* ignore fallback errors */ }
    }

    if (invalid.length) {
      res.status(400).json({
        error: 'selection-export requires all items to include a numeric DB id; refusing to write report',
        invalidIndexes: invalid,
        missingCount: invalid.length,
        note: 'Tried slug lookups and populate-ids-from-log fallback; no numeric id found for these items.'
      });
      return;
    }
    const out = { selected };
    const tmpDir = path.join(process.cwd(), 'tmp');
    const outfile = path.join(tmpDir, 'selection-from-pipeline.json');
    try { fs.mkdirSync(tmpDir, { recursive: true }); } catch {}
  fs.writeFileSync(outfile, JSON.stringify(out, null, 2), 'utf8');
  res.status(200).json({ ok: true, path: outfile, count: selected.length });
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}

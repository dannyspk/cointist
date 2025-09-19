import type { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'

function runScript(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const p = execFile(cmd, args, { cwd, env: process.env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || (err && err.message) || '', code: err && (err as any).code ? (err as any).code : (err ? 1 : 0) });
    });
    // safety: kill process after 2 minutes
    setTimeout(() => { try { p.kill(); } catch(_){} }, 2 * 60 * 1000);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, slug, title, excerpt, oldslug, oldslugs } = req.body || {}
  if (!id && !slug) return res.status(400).json({ error: 'Missing id or slug' })
  try {
    const outDir = path.join(process.cwd(), 'tmp')
    await fs.promises.mkdir(outDir, { recursive: true })
  // Preserve any original-source slug(s) if provided so upload script can match by them
  const selectionItem: any = { id, slug, title, excerpt };
  if (oldslug) selectionItem.oldslug = oldslug;
  if (Array.isArray(oldslugs) && oldslugs.length) selectionItem.oldslugs = oldslugs;
  const selected = { count: 1, selected: [selectionItem], createdAt: new Date().toISOString() }
    const selPath = path.join(outDir, 'selected.json')
    await fs.promises.writeFile(selPath, JSON.stringify(selected, null, 2), 'utf8')
    // run the upload script
    const scriptPath = path.join(process.cwd(), 'scripts', 'upload-and-attach-gcs.js')
    if (!fs.existsSync(scriptPath)) return res.status(500).json({ error: 'upload script missing' })
    const nodeBin = process.execPath
    const cwd = process.cwd()
    const result = await runScript(nodeBin, [scriptPath], cwd)
    // return combined output
    return res.status(200).json({ ok: true, outPath: selected.selected[0] && selected.selected[0].slug ? `/uploads/${path.basename(selected.selected[0].slug)}.png` : null, stdout: result.stdout, stderr: result.stderr, code: result.code })
  } catch (e:any) {
    return res.status(500).json({ error: e?.message || String(e) })
  }
}

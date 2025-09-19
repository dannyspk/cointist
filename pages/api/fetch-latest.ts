import type { NextApiRequest, NextApiResponse } from 'next'
import { spawn } from 'child_process'
import path from 'path'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
  const script = path.join(process.cwd(), 'scripts', 'fetch-trending-aggregator.js')
  const outPath = path.join(process.cwd(), 'tmp', 'trending-aggregator-last.json')
  // Parse hours from body; allow only 6/12/24, default 6
  const body: any = req.body || {}
  let hours = parseInt(body.hours, 10)
  if (![6, 12, 24].includes(hours)) hours = 6
  // Run the script with explicit --out path; capture output but do not block page.
  const child = spawn(process.execPath, [script, `--out=${outPath}`, `--hours=${hours}`], { cwd: process.cwd(), env: process.env })
    let out = ''
    let err = ''
    child.stdout.on('data', d => { out += d.toString() })
    child.stderr.on('data', d => { err += d.toString() })
    child.on('close', (code) => {
      // Optionally, write output to tmp log file later
      console.log(`[fetch-latest] exited with ${code}`)
      if (out) console.log(out)
      if (err) console.error(err)
    })
    return res.status(200).json({ ok: true, pid: child.pid })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'failed to spawn fetch' })
  }
}

import { NextApiRequest, NextApiResponse } from 'next'
import fs from 'fs'
import path from 'path'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    const selPath = path.join(process.cwd(), 'tmp', 'selected.json')
    if (!fs.existsSync(selPath)) return res.status(200).json({ ok: true, ready: false, items: null })
    try {
      const raw = fs.readFileSync(selPath, 'utf8')
      const j = JSON.parse(raw)
      const items = Array.isArray(j.items) ? j.items : (Array.isArray(j.selected) ? j.selected : (Array.isArray(j) ? j : []))
      return res.status(200).json({ ok: true, ready: true, items })
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) })
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) })
  }
}

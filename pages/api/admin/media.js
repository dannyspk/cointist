import fs from 'fs'
import path from 'path'
import { requireAdmin } from '../../../src/lib/auth'

export default function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const uploads = path.join(process.cwd(), 'public', 'uploads')
  if (!fs.existsSync(uploads)) return res.json({ data: [] })
  if (req.method === 'GET') {
    try {
      const files = fs.readdirSync(uploads).map(f => {
        const stat = fs.statSync(path.join(uploads, f))
        return { name: f, url: `/uploads/${f}`, size: stat.size, mtime: stat.mtime }
      })
      // newest first
      files.sort((a,b) => new Date(b.mtime) - new Date(a.mtime))
      return res.json({ data: files })
    } catch (e) { return res.status(500).json({ error: String(e) }) }
  }
  if (req.method === 'DELETE') {
    // delete by filename
    const { name } = req.query
    if (!name) return res.status(400).json({ error: 'name required' })
    const target = path.join(uploads, path.basename(String(name)))
    try { fs.unlinkSync(target); return res.json({ ok: true }) } catch (e) { return res.status(500).json({ error: String(e) }) }
  }
  res.setHeader('Allow', ['GET','DELETE'])
  res.status(405).end('Method Not Allowed')
}

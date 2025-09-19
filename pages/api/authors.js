import path from 'path'
import fs from 'fs'
import getSupabaseServer from '../../src/lib/supabaseServer'

export default async function handler(req, res) {
  // Try Supabase first if configured
  try {
    let supa
    try { supa = getSupabaseServer(); } catch (e) { supa = null }
    if (supa) {
      // Attempt to read from Authors (case-insensitive table name handling)
      const candidates = ['Authors', 'authors', 'Author', 'author']
      for (const t of candidates) {
        try {
          const { data, error } = await supa.from(t).select('name, lead, image').limit(500)
          if (!error && Array.isArray(data)) {
            // Normalize shape for frontend
            const out = data.map(r => ({ name: r.name || r.full_name || r.display_name || '', lead: r.lead || r.bio || '', image: r.image || r.avatar || '' }))
            return res.json(out)
          }
        } catch (e) {
          // ignore and try next candidate
        }
      }
    }
  } catch (e) {
    // fall back to static file below
  }

  // Fallback: serve static authors.json if present
  try {
    const p = path.join(process.cwd(), 'data', 'authors.json')
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8')
      const authors = JSON.parse(raw)
      return res.json(authors)
    }
    return res.json([])
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}

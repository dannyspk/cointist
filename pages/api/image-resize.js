import fs from 'fs'
import path from 'path'

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

export default async function handler(req, res) {
  try {
    const { path: imgPath, w, h } = req.query
    if (!imgPath || typeof imgPath !== 'string') {
      res.status(400).end('missing path')
      return
    }

    // Only allow images inside the public folder (relative paths starting with /uploads or /assets)
    if (!imgPath.startsWith('/uploads') && !imgPath.startsWith('/assets')) {
      res.status(400).end('invalid path')
      return
    }

    const publicDir = path.join(process.cwd(), 'public')
    const safeRelative = imgPath.replace(/^\/+/, '')
    const filePath = path.join(publicDir, safeRelative)

    // Prevent path traversal
    if (!filePath.startsWith(publicDir)) {
      res.status(400).end('invalid path')
      return
    }

    if (!fs.existsSync(filePath)) {
      res.status(404).end('not found')
      return
    }

    const width = w ? parseInt(w, 10) : null
    const height = h ? parseInt(h, 10) : null

    const ext = path.extname(filePath).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    const buffer = await fs.promises.readFile(filePath)

    // dynamic import to avoid bundling sharp into functions that don't need it
    let sharp;
    try { sharp = (await import('sharp')).default || (await import('sharp')); } catch (e) { sharp = null }
    if (!sharp) {
      res.status(501).end('image processing unavailable')
      return
    }

    let transformer = sharp(buffer)
    if (width || height) {
      // When both dimensions are provided, use a focused crop to keep subject in frame
      if (width && height) {
        transformer = transformer.resize(width, height, { fit: 'cover', position: 'attention' })
      } else {
        transformer = transformer.resize(width || null, height || null)
      }
    }

    // Output as original format where possible
    const outBuffer = await transformer.toBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    res.status(200).end(outBuffer)
  } catch (err) {
    console.error('image-resize error', err)
    res.status(500).end('error')
  }
}

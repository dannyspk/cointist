#!/usr/bin/env node
// Download top Pexels images for keywords extracted from a title,
// resize to a 96x96 thumbnail and a 1200px wide optimized image,
// and save into public/assets.

const fs = require('fs')
const path = require('path')
const { extractKeywords } = require('../src/utils/keywords')
const sharp = require('sharp')

const API_KEY = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY
if (!API_KEY){
  console.error('PEXELS_API_KEY environment variable not set')
  process.exit(1)
}

const OUT_DIR = path.join(process.cwd(), 'public', 'assets')
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

async function searchPexels(query, perPage = 1){
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
  const res = await fetch(url, { headers: { Authorization: API_KEY } })
  if (!res.ok) throw new Error(`Pexels API failed: ${res.status} ${res.statusText}`)
  const json = await res.json()
  return json.photos || []
}

async function downloadBuffer(url){
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function sanitizeFilename(s){
  return s.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').toLowerCase()
}

async function processTitle(title){
  const keywords = extractKeywords(title, { max: 6, minLength: 3 })
  console.log('Keywords:', keywords.join(', '))
  const saved = []
  for (const kw of keywords){
    try{
      const photos = await searchPexels(kw, 1)
      if (!photos || photos.length === 0){
        console.log(`No photos for '${kw}'`)
        continue
      }
      const photo = photos[0]
      // prefer large size
      const src = photo.src && (photo.src.large2x || photo.src.large || photo.src.original)
      if (!src){
        console.log('No suitable src for photo id', photo.id)
        continue
      }
      console.log(`Downloading photo ${photo.id} for '${kw}'`)
      const buf = await downloadBuffer(src)
      const base = `pexels-${photo.id}-${sanitizeFilename(kw)}`
      const fullPath = path.join(OUT_DIR, base + '-1200w.jpg')
      const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')

      // Resize/optimize
      try{
        await sharp(buf).resize({ width: 1200 }).jpeg({ quality: 82 }).toFile(fullPath)
        await sharp(buf).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(thumbPath)
        console.log('Saved:', fullPath, thumbPath)
        saved.push({ kw, photoId: photo.id, full: path.relative(process.cwd(), fullPath), thumb: path.relative(process.cwd(), thumbPath) })
      }catch(e){
        console.error('Sharp failed for', photo.id, e && e.message)
      }
    }catch(e){
      console.error('Error handling keyword', kw, e && e.message)
    }
  }
  const outFile = path.join(process.cwd(), 'tmp', `pexels-download-${Date.now()}.json`)
  if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true })
  fs.writeFileSync(outFile, JSON.stringify({ title, saved }, null, 2))
  console.log('Summary written to', outFile)
}

async function main(){
  const title = process.argv.slice(2).join(' ').trim()
  if (!title){
    console.error('Usage: node scripts/pexels-download-by-title.js "Article title here"')
    process.exit(1)
  }
  await processTitle(title)
}

main().catch(e=>{ console.error(e); process.exit(1) })

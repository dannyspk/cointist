#!/usr/bin/env node
// Find recent 'latest' articles from Prisma, fetch images from Pexels using extracted keywords,
// save files to public/assets and update Article.coverImage and Article.thumbnail fields.
// Usage: set PEXELS_API_KEY in env, then run: node scripts/pexels-attach-to-articles.js

const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')
const sharp = require('sharp')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const { extractKeywords } = require('../src/utils/keywords')

const API_KEY = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY
if (!API_KEY){
  console.error('PEXELS_API_KEY environment variable not set')
  process.exit(1)
}

function sanitizeFilename(s){
  return s.replace(/[^a-z0-9-_]/gi, '-').replace(/-+/g, '-').toLowerCase()
}

async function searchPexels(query, perPage = 3){
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
  const res = await fetch(url, { headers: { Authorization: API_KEY } })
  if (!res.ok) return []
  const json = await res.json()
  return json.photos || []
}

async function downloadBuffer(url){
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function processArticle(it){
  const title = it.title || ''
  const keywords = extractKeywords(title, { max: 6, minLength: 3 })
  console.log('\nArticle:', it.id, it.slug)
  console.log('Keywords:', keywords.join(', '))

  const OUT_DIR = path.join(process.cwd(), 'public', 'assets')
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const kw of keywords){
    try{
      const photos = await searchPexels(kw, 3)
      if (!photos || photos.length === 0) continue
      const photo = photos[0]
      const src = photo.src && (photo.src.large2x || photo.src.large || photo.src.original || photo.src.medium)
      if (!src) continue
      const buf = await downloadBuffer(src)
      const base = `article-${it.id || sanitizeFilename(it.slug || title).slice(0,12)}-pexels-${photo.id}-${sanitizeFilename(kw)}`
      const fullRel = `/assets/${base}-1200w.jpg`
      const thumbRel = `/assets/${base}-96sq.jpg`
      const fullPath = path.join(OUT_DIR, base + '-1200w.jpg')
      const thumbPath = path.join(OUT_DIR, base + '-96sq.jpg')
      await sharp(buf).resize({ width: 1200 }).jpeg({ quality: 82 }).toFile(fullPath)
      await sharp(buf).resize(96, 96, { fit: 'cover' }).jpeg({ quality: 82 }).toFile(thumbPath)
      console.log('Saved for article', it.id, fullPath, thumbPath)
      // update DB
      await prisma.article.update({ where: { id: it.id }, data: { coverImage: fullRel, thumbnail: thumbRel } })
      return { full: fullRel, thumb: thumbRel, photoId: photo.id, keyword: kw }
    }catch(e){
      console.debug('Error searching/downloading for', kw, e && e.message)
      continue
    }
  }
  console.log('No image found for article', it.id)
  return null
}

async function main(){
  try{
    const articles = await prisma.article.findMany({ where: { subcategory: 'latest' }, orderBy: { id: 'desc' }, take: 5 })
    if (!articles || articles.length === 0){
      console.log('No articles found')
      return
    }
    const results = []
    for (const a of articles){
      const r = await processArticle(a)
      results.push({ id: a.id, slug: a.slug, saved: r })
    }
    const outFile = path.join(process.cwd(), 'tmp', `pexels-attach-${Date.now()}.json`)
    if (!fs.existsSync(path.dirname(outFile))) fs.mkdirSync(path.dirname(outFile), { recursive: true })
    fs.writeFileSync(outFile, JSON.stringify(results, null, 2))
    console.log('\nSummary written to', outFile)
  }catch(e){
    console.error('Fatal error', e && e.message)
    process.exit(1)
  }finally{
    await prisma.$disconnect()
  }
}

main()

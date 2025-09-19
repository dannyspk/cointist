#!/usr/bin/env node
// Fetch images from Pexels using keywords extracted from an article title
// Usage: PEXELS_API_KEY must be set in environment. Run:
//    node scripts/pexels-fetch-by-title.js "Article title here"

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const { extractKeywords } = require('../src/utils/keywords')

const API_KEY = process.env.PEXELS_API_KEY || process.env.PEXELS_KEY
if (!API_KEY){
  console.error('PEXELS_API_KEY environment variable not set')
  process.exit(1)
}

async function searchPexels(query, perPage = 6){
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}`
  const res = await fetch(url, { headers: { Authorization: API_KEY } })
  if (!res.ok) throw new Error(`Pexels search failed: ${res.status} ${res.statusText}`)
  const json = await res.json()
  return json
}

async function main(){
  const title = process.argv.slice(2).join(' ').trim()
  if (!title){
    console.error('Usage: node scripts/pexels-fetch-by-title.js "Article title here"')
    process.exit(1)
  }

  const keywords = extractKeywords(title, { max: 6, minLength: 3 })
  console.log('Extracted keywords:', keywords.join(', '))

  const results = {}
  for (const kw of keywords){
    try{
      const res = await searchPexels(kw, 6)
      results[kw] = res.photos || []
      console.log(`Found ${results[kw].length} photos for '${kw}'`)
    }catch(e){
      console.error('Search error for', kw, e && e.message || e)
      results[kw] = []
    }
  }

  const outDir = path.join(process.cwd(), 'tmp', 'pexels')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outFile = path.join(outDir, `pexels-results-${Date.now()}.json`)
  fs.writeFileSync(outFile, JSON.stringify({ title, keywords, results }, null, 2))
  console.log('Results written to', outFile)
}

main().catch(e=>{ console.error(e); process.exit(1) })

#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')

function splitSentences(s){
  return String(s||'')
    .replace(/\s+/g,' ')
    .split(/(?<=[.?!])\s+(?=[A-Z0-9"'\(])/)
    .map(t=>t.trim())
    .filter(Boolean)
}

function normalize(s){ return String(s||'').replace(/\s+/g,' ').trim().toLowerCase() }

async function fetchVisibleText(url){
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RephraserChecker/1.0)' } })
  if(!res.ok) throw new Error('Fetch failed '+res.status)
  let html = await res.text()
  // remove script/style blocks
  html = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  html = html.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  // remove comments
  html = html.replace(/<!--([\s\S]*?)-->/g, ' ')
  // remove tags
  let text = html.replace(/<[^>]+>/g, ' ')
  // collapse whitespace
  text = text.replace(/\s+/g,' ').trim()
  return text
}

function jaccard(a,b){
  const A = new Set(String(a||'').split(/\W+/).filter(Boolean))
  const B = new Set(String(b||'').split(/\W+/).filter(Boolean))
  const inter = new Set([...A].filter(x=>B.has(x)))
  const uni = new Set([...A,...B])
  return uni.size ? (inter.size/uni.size) : 0
}

function topN(arr, n=5){ return arr.slice(0,n) }

async function main(){
  const url = process.argv[2] || 'https://crypto.news/dogecoin-price-rejects-from-resistance-at-0-30-but-will-support-at-0-24-hold/'
  const samplePath = path.resolve(process.cwd(),'pages','sample.txt')
  if(!fs.existsSync(samplePath)){ console.error('Missing pages/sample.txt'); process.exit(2) }
  const sample = fs.readFileSync(samplePath,'utf8')

  console.error('Fetching source URL:', url)
  let srcText = ''
  try{ srcText = await fetchVisibleText(url) }catch(e){ console.error('Fetch failed:', e.message); process.exit(2) }

  const srcSent = splitSentences(srcText)
  const sampleSent = splitSentences(sample)

  const normSrc = srcSent.map(s=>normalize(s))
  const normSample = sampleSent.map(s=>normalize(s))

  const exactMatches = normSample.filter(s => normSrc.includes(s))

  const tokenSimilarities = normSample.map((s, idx) => {
    let best = 0; let bestIdx = -1
    for(let i=0;i<normSrc.length;i++){
      const sim = jaccard(s, normSrc[i])
      if(sim>best){ best = sim; bestIdx = i }
    }
    return { index: idx, sentence: sampleSent[idx], bestSim: best, bestIdx }
  })

  const avgSim = tokenSimilarities.reduce((a,b)=>a+b.bestSim,0)/Math.max(1,tokenSimilarities.length)

  console.log('--- Comparison Report ---')
  console.log('Source sentences:', srcSent.length)
  console.log('Rephraser sentences:', sampleSent.length)
  console.log('Exact sentence matches:', exactMatches.length)
  console.log('Average token Jaccard similarity (per sentence):', avgSim.toFixed(3))
  console.log('Top 5 lowest-similarity rephraser sentences:')
  tokenSimilarities
    .slice()
    .sort((a,b)=>a.bestSim-b.bestSim)
    .slice(0,5)
    .forEach(x=> console.log(`#${x.index} sim=${x.bestSim.toFixed(3)} -> ${x.sentence.slice(0,200)}`))

  // Show examples where similarity is high
  console.log('\nTop 5 highest-similarity rephraser sentences:')
  tokenSimilarities
    .slice()
    .sort((a,b)=>b.bestSim-a.bestSim)
    .slice(0,5)
    .forEach(x=> console.log(`#${x.index} sim=${x.bestSim.toFixed(3)} -> ${x.sentence.slice(0,200)}`))
}

if(require.main === module) main().catch(e=>{ console.error(e); process.exit(2) })

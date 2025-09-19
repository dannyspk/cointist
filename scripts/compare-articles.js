#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const fetch = global.fetch || require('node-fetch')
const { JSDOM } = require('jsdom')

function textFromNode(node){ if(!node) return ''; return node.textContent.replace(/\s+/g,' ').trim() }

async function fetchAndExtract(url){
  try{
    let html = null
    // support local files: file:// URIs or existing filesystem paths
    try{
      if(String(url).startsWith('file://')){
        const p = String(url).replace(/^file:\/\//, '')
        html = fs.readFileSync(p, 'utf8')
      } else if(fs.existsSync(url) || fs.existsSync(path.resolve(url))){
        const p = fs.existsSync(url) ? url : path.resolve(url)
        html = fs.readFileSync(p, 'utf8')
      }
    }catch(e){ /* fall through to network fetch */ }
    if(!html){
      const res = await fetch(url, { headers: { 'User-Agent': 'cointist-compare/1.0' }, timeout: 20000 })
      if(!res.ok) return { url, error: `HTTP ${res.status}` }
      html = await res.text()
    }
    const dom = new JSDOM(html)
    const doc = dom.window.document
    // attempt common article selectors
    const selectors = ['article','main','[role="main"]','.article-content','.post-content','.entry-content','.content','#content','.story-body']
    let content = ''
    for(const sel of selectors){ const el = doc.querySelector(sel); if(el){ const t = textFromNode(el); if(t && t.length>200){ content = t; break } } }
    if(!content){
      // fallback: collect top paragraphs
      const pNodes = Array.from(doc.querySelectorAll('p'))
      if(pNodes.length){
        // choose parent with most text
        const blocks = new Map()
        pNodes.forEach(p=>{
          const key = p.parentElement ? p.parentElement.outerHTML.slice(0,200) : 'root'
          const prev = blocks.get(key) || []
          prev.push(p)
          blocks.set(key, prev)
        })
        let best = { text:'', size:0 }
        blocks.forEach((ps)=>{
          const txt = ps.map(p=>textFromNode(p)).join('\n\n')
          if(txt.length>best.size) best = { text: txt, size: txt.length }
        })
        if(best.size>0) content = best.text
      }
    }
    // final fallback: body text
    if(!content) content = textFromNode(doc.body || doc.documentElement)
    return { url, content, html }
  }catch(e){ return { url, error: String(e) } }
}

function sentences(text){
  if(!text) return []
  // crude sentence split
  return text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean)
}

function extractEntitiesAndNumbers(text){
  const ents = []
  if(!text) return { ents: [], nums: [] }
  // numbers
  const nums = Array.from(new Set((text.match(/\b\d[\d,\.\%]+\b/g) || []).map(s=>s.trim())))
  // capitalized phrase heuristics
  const caps = Array.from(new Set((text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/g) || []).map(s=>s.trim()))).slice(0,50)
  return { ents: caps, nums }
}

function overlapRatio(a, b){
  if(!a || !b) return 0
  const setA = new Set(a.split(/\s+/).filter(Boolean).map(w=>w.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()))
  const setB = new Set(b.split(/\s+/).filter(Boolean).map(w=>w.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()))
  const inter = Array.from(setA).filter(x=>setB.has(x))
  return (inter.length / Math.max(1, setA.size))
}

(async()=>{
  const [,, urlA, urlB] = process.argv
  if(!urlA || !urlB){ console.error('Usage: node compare-articles.js <original-url> <rephrased-url>'); process.exit(2) }
  console.log('Fetching A:', urlA)
  const a = await fetchAndExtract(urlA)
  console.log('Fetching B:', urlB)
  const b = await fetchAndExtract(urlB)
  if(a.error) { console.error('Error fetching A:', a.error); process.exit(1) }
  if(b.error) { console.error('Error fetching B:', b.error); process.exit(1) }

  const aText = a.content || ''
  const bText = b.content || ''
  const aSents = sentences(aText)
  const bSents = sentences(bText)

  const aEN = extractEntitiesAndNumbers(aText)
  const bEN = extractEntitiesAndNumbers(bText)

  const entityMissing = aEN.ents.filter(e => { return !bText.toLowerCase().includes(e.toLowerCase()) }).slice(0,40)
  const numsMissing = aEN.nums.filter(n => { return !bText.includes(n) }).slice(0,40)

  const wordOverlap = overlapRatio(aText, bText)

  console.log('\n--- Summary ---')
  console.log('Original length (words):', (aText.split(/\s+/).filter(Boolean)).length)
  console.log('Rephrase length (words):', (bText.split(/\s+/).filter(Boolean)).length)
  console.log('Sentence counts: original=', aSents.length, 'rephrase=', bSents.length)
  console.log('Approx word-overlap ratio (fraction of original words present in rephrase):', wordOverlap.toFixed(3))
  console.log('\nTop named entities present in original (sample):', (aEN.ents||[]).slice(0,20))
  console.log('Named entities from original missing in rephrase (sample):', entityMissing.slice(0,20))
  console.log('\nNumbers/figures in original missing in rephrase (sample):', numsMissing)

  // list first 8 original sentences with an indicator whether similar content exists in rephrase
  console.log('\nFirst 8 original sentences and whether rephrase contains key words:')
  for(let i=0;i<Math.min(8,aSents.length);i++){
    const s = aSents[i]
    const key = s.split(/[,;:\-()]/)[0].split(/\s+/).slice(0,8).join(' ')
    const present = bText.toLowerCase().includes(key.toLowerCase())
    console.log(`${i+1}. ${present ? '[PRESENT]' : '[MISSING]'} ${s}`)
  }

  // write detailed outputs
  const out = { original: { url: urlA, text: aText, sentences: aSents, ents: aEN }, rephrase: { url: urlB, text: bText, sentences: bSents, ents: bEN }, metrics: { wordOverlap, entityMissing, numsMissing } }
  const outPath = path.join(process.cwd(),'tmp',`compare-${Date.now()}.json`)
  if(!fs.existsSync(path.dirname(outPath))) fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8')
  console.log('\nDetailed comparison written to', outPath)
})()

#!/usr/bin/env node
/*
  upsert-advanced-guides.js

  Read HTML files from a folder of advanced guides and upsert the main article
  content into the Supabase `Guides` table. Does a dry-run by default. To apply
  changes, run with --apply --yes and ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
  (or SUPABASE_ANON_KEY) are set in the environment.

  Usage (dry-run):
    node scripts/upsert-advanced-guides.js --dir="c:\\Users\\Danish\\Desktop\\cointist_advanced_guides"

  Apply changes:
    $env:SUPABASE_URL='...'; $env:SUPABASE_SERVICE_ROLE_KEY='...'; node scripts/upsert-advanced-guides.js --dir="..." --apply --yes
*/

const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const argv = require('minimist')(process.argv.slice(2))

const DIR = argv.dir || 'c:\\Users\\Danish\\Desktop\\cointist_advanced_guides'
const APPLY = !!argv.apply
const YES = !!argv.yes || !!argv.Y

function sanitizeSlug(t){ return (t||'').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80) }

function extractMainFromHtml(html){
  const dom = new JSDOM(html)
  const doc = dom.window.document
  // try common selectors for the main article element
  const selectors = ['article','main','[role="main"]','.article-content','.post-content','.entry-content','.content','#content','.story-body']
  for(const sel of selectors){ const el = doc.querySelector(sel); if(el && el.textContent && el.textContent.trim().length>50){ return { html: el.innerHTML.trim(), text: el.textContent.trim() } } }
  // fallback: take largest <div> or the body
  let best = { node: null, len: 0 }
  const divs = Array.from(doc.querySelectorAll('div,section'))
  for(const d of divs){ const txt = d.textContent ? d.textContent.trim() : ''; if(txt.length > best.len){ best = { node: d, len: txt.length } } }
  if(best.node && best.len > 50) return { html: best.node.innerHTML.trim(), text: best.node.textContent.trim() }
  // final fallback: body innerHTML truncated
  return { html: (doc.body && doc.body.innerHTML) ? doc.body.innerHTML.trim() : '', text: (doc.body && doc.body.textContent) ? doc.body.textContent.trim() : '' }
}

function extractTitle(doc){
  const h1 = doc.querySelector('h1')
  if(h1 && h1.textContent && h1.textContent.trim()) return h1.textContent.trim()
  const h2 = doc.querySelector('h2')
  if(h2 && h2.textContent && h2.textContent.trim()) return h2.textContent.trim()
  // meta og:title
  const og = doc.querySelector('meta[property="og:title"]') || doc.querySelector('meta[name="og:title"]')
  if(og && og.getAttribute('content')) return og.getAttribute('content').trim()
  return null
}

async function main(){
  if(!fs.existsSync(DIR)){
    console.error('Directory not found:', DIR)
    process.exit(1)
  }
  const files = fs.readdirSync(DIR).filter(f => f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm'))
  if(!files.length){ console.error('No HTML files found in', DIR); process.exit(1) }

  const payloads = []
  for(const f of files){
    const abs = path.join(DIR, f)
    try{
      const raw = fs.readFileSync(abs,'utf8')
      const dom = new JSDOM(raw)
      const doc = dom.window.document
      const title = extractTitle(doc) || path.basename(f, path.extname(f))
      const main = extractMainFromHtml(raw)
      const slug = sanitizeSlug(title)
      // Build article record - only main article content is used (no hero)
      const rec = {
        title: title,
        slug: slug,
        author: 'Luca De Santis',
        category: 'Guides',
        excerpt: (main.text || '').split('\n').slice(0,2).join(' ').slice(0,240),
        content: `<article>\n${main.html}\n</article>`,
        tags: ['Advanced'],
        featuredDescription: null
      }
      payloads.push({ file: f, record: rec })
    }catch(e){ console.error('Failed to read/parse', f, e && e.message) }
  }

  console.log('\nFound', payloads.length, 'guide HTML files to upsert:')
  payloads.forEach((p,i)=>{
    console.log(`${i+1}. ${p.file} -> title: ${p.record.title} slug: ${p.record.slug}`)
  })

  if(!APPLY){
    console.log('\nDry-run mode (no DB writes). To apply changes run with --apply --yes and set SUPABASE env keys.')
    return
  }

  if(APPLY && !YES){
    console.log('\n--apply specified without --yes; aborting. Re-run with --apply --yes to proceed.')
    return
  }

  // Attempt Supabase upserts
  const SUPA_URL = process.env.SUPABASE_URL
  const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if(!SUPA_URL || !SUPA_KEY){ console.error('SUPABASE_URL or SUPABASE_KEY missing in env; cannot perform upserts'); process.exit(1) }

  const { createClient } = require('@supabase/supabase-js')
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  for(const p of payloads){
    const table = 'Guides'
    const dataToInsert = Object.assign({}, p.record)
    try{
      // Ensure unique slug by appending suffix if exists
      const { data: existing } = await supa.from(table).select('id,slug').eq('slug', dataToInsert.slug).limit(1)
      if(existing && existing[0]){
        const suffix = String(Date.now()).slice(-6)
        dataToInsert.slug = `${dataToInsert.slug}-${suffix}`
      }
      const { data: ins, error: insErr } = await supa.from(table).insert([dataToInsert]).select()
      if(insErr){ console.error('Insert error for', p.file, insErr); continue }
      const created = ins && ins[0]
      console.log('Upserted', p.file, '-> id:', created && created.id, 'slug:', created && created.slug)
      try{ await supa.from('ArticleVersion').insert([{ articleId: created.id, title: created.title, excerpt: created.excerpt || null, content: created.content || '', data: { createdAt: created.createdAt } }]) }catch(e){ console.error('Version insert failed', e && e.message) }
    }catch(e){ console.error('Upsert failed for', p.file, e && e.message) }
  }
}

main().catch(e=>{ console.error('Fatal', e && e.message); process.exit(1) })

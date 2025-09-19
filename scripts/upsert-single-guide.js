#!/usr/bin/env node
/*
Upsert a single guide HTML into Supabase Guides table.
Usage:
  $env:SUPABASE_URL='...' ; $env:SUPABASE_SERVICE_ROLE_KEY='...' ; node scripts/upsert-single-guide.js --file="C:\path\to\defi-systemic-risk-insurance.html" --image="C:\path\to\insurance.png" --title="Optional Title"

Behavior:
 - Extracts content between <article>...</article> and uses that as content body (wraps with <article>..</article> in DB).
 - Sets author to 'Luca De Santis', tags ['Advanced'], no excerpt.
 - Uploads image file to Supabase storage 'images' bucket under 'uploads/' prefix and sets both coverImage and thumbnail to the public URL.
 - Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) env vars.
*/

const fs = require('fs')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const { JSDOM } = require('jsdom')

const SUPA_URL = process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
if(!SUPA_URL || !SUPA_KEY){ console.error('Missing SUPABASE env keys. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY)'); process.exit(1) }

const { createClient } = require('@supabase/supabase-js')
const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

function parseArgs(){
  const out = { file: argv.file || argv.f, image: argv.image || argv.i, title: argv.title }
  return out
}

function extractArticleHtml(raw){
  const m = raw.match(/<article[\s\S]*?<\/article>/i)
  if(m) return m[0]
  // fallback: return full body
  const dom = new JSDOM(raw)
  return dom.window.document.body ? dom.window.document.body.innerHTML : raw
}

async function uploadImage(localPath){
  if(!fs.existsSync(localPath)) throw new Error('Image file not found: '+localPath)
  const base = path.basename(localPath)
  const dest = `uploads/${Date.now()}-${base}`
  // prefer storage bucket 'images' if present, else 'uploads'
  const bucket = process.env.SUPABASE_IMAGE_BUCKET || 'images'
  console.log('Uploading to bucket', bucket, 'as', dest)
  const b = supa.storage.from(bucket)
  const file = fs.readFileSync(localPath)
  const res = await b.upload(dest, file, { upsert: true, contentType: 'image/png' }).catch(e=>{ throw e })
  if(res.error) throw new Error(res.error.message || JSON.stringify(res.error))
  // get public url
  const url = b.getPublicUrl(dest).data.publicUrl
  return url
}

async function upsertArticle(articleHtml, title){
  const slug = (title || 'defi-systemic-risk-insurance').toString().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80)
  const payload = {
    title: title || 'Defi systemic risk & insurance',
    slug,
    author: 'Luca De Santis',
    category: 'Guides',
    excerpt: null,
    content: articleHtml,
    tags: ['Advanced'],
    featuredDescription: null
  }
  // ensure unique slug
  const { data: existing } = await supa.from('Guides').select('id,slug').eq('slug', slug).limit(1)
  if(existing && existing[0]) payload.slug = `${payload.slug}-${String(Date.now()).slice(-6)}`
  const { data: ins, error: insErr } = await supa.from('Guides').insert([payload]).select()
  if(insErr) throw insErr
  return ins && ins[0]
}

async function run(){
  const args = parseArgs()
  if(!args.file) { console.error('Missing --file argument'); process.exit(1) }
  const image = args.image
  if(!image){ console.error('Missing --image argument'); process.exit(1) }

  const raw = fs.readFileSync(args.file,'utf8')
  const articleHtml = extractArticleHtml(raw)

  console.log('Uploading image...')
  let url
  try{ url = await uploadImage(image) }catch(e){ console.error('Image upload failed', e.message || e); process.exit(1) }
  console.log('Image uploaded ->', url)

  console.log('Upserting article...')
  const created = await upsertArticle(articleHtml, args.title)
  console.log('Created article id', created && created.id)

  // update article with coverImage/thumbnail
  const update = { coverImage: url, thumbnail: url }
  const { data: upd, error: updErr } = await supa.from('Guides').update(update).eq('id', created.id).select()
  if(updErr){ console.error('Update cover/thumbnail failed', updErr); process.exit(1) }
  console.log('Set coverImage/thumbnail for article id', created.id)
  process.exit(0)
}

run().catch(e=>{ console.error('Fatal', e && (e.message || e)); process.exit(1) })

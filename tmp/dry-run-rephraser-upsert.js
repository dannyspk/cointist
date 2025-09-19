const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

async function findRephraseFile(provided){
  if(provided){ const p = path.resolve(provided); if(fs.existsSync(p)) return p; throw new Error('Provided file not found: '+p) }
  const dir = path.join(process.cwd(),'tmp')
  if(!fs.existsSync(dir)) throw new Error('tmp/ not found')
  const files = fs.readdirSync(dir).filter(f=>f.startsWith('rephrase-') && f.endsWith('.html'))
  if(!files.length) throw new Error('No rephrase-*.html files in tmp/')
  files.sort()
  return path.join(dir, files[files.length-1])
}

function extractTitle(html){
  try{ const m = String(html).match(/<h2[^>]*>([\s\S]*?)<\/h2>/i); if(m && m[1]) return m[1].replace(/<[^>]+>/g,'').trim() }catch(e){}
  return ''
}

function stripHtml(html){ return String(html).replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim() }

async function main(){
  try{
    const arg = process.argv[2]
    const file = await findRephraseFile(arg)
  let html = fs.readFileSync(file,'utf8')
  // Remove model-inserted code fences like ```html ... ```
  html = String(html || '').replace(/^\s*```(?:html)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
    const title = extractTitle(html)
    const slugify = s => String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,120)
    const slug = title ? slugify(title) : crypto.createHash('sha1').update(html).digest('hex').slice(0,12)
    const id = crypto.createHash('sha1').update(html).digest('hex')
    const summary = stripHtml(html).slice(0,360)
    // Upsert by slug; do not send 'id' (DB uses integer primary key)
    const row = {
      slug,
      title: title || '',
      category: 'News',
      subcategory: 'latest',
      author: 'Cointist',
      excerpt: summary || null,
      content: html || null,
      published: false,
      publishedAt: null,
      coverImage: null,
      thumbnail: null,
      tags: null
    }

    console.log('DRY RUN prepared upsert row (will attempt real upsert only if SUPABASE env vars are set):')
    console.log(JSON.stringify({ file, row }, null, 2))

    // If SUPABASE env present, attempt upsert
    const SUPA_URL = process.env.SUPABASE_URL
    const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    if(SUPA_URL && SUPA_KEY){
      try{
        const { createClient } = require('@supabase/supabase-js')
        const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })
        console.log('Supabase env detected; attempting upsert into Article (this will make a network call)')
  const up = await supa.from('Article').upsert([row], { onConflict: 'slug' })
        console.log('Supabase upsert result:', up)
      }catch(e){
        console.error('Supabase upsert exception:', (e && e.message) || e)
      }
    } else {
      console.log('No SUPABASE env vars set; skipping real upsert.')
    }
  }catch(e){
    console.error('Dry run failed:', e && e.message ? e.message : e)
    process.exit(1)
  }
}

main()

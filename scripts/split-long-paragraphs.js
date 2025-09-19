const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')

function splitIntoParagraphs(text, prefer=3){
  if (!text) return []
  // Normalize whitespace
  const norm = text.replace(/\s+/g,' ').trim()
  // Split into sentences. Allow for closing quotes before whitespace.
  const sentences = norm.split(/(?<=[\.\?\!])\s+(?=(?:["'\u201c\u201d\u2018\u2019\(\[])?[A-Z0-9])/g).map(s=>s.trim()).filter(Boolean)
  if (sentences.length <= 1) return [norm]
  const out = []
  const size = prefer
  for (let i=0;i<sentences.length;i+=size){
    out.push(sentences.slice(i,i+size).join(' '))
  }
  return out
}

async function main(){
  const cmsFile = path.resolve(process.cwd(), '.cms.json')
  if (!fs.existsSync(cmsFile)) return console.error('.cms.json not found; abort')
  const cms = JSON.parse(fs.readFileSync(cmsFile,'utf8'))
  const token = jwt.sign({ user: cms.username || 'admin' }, cms.jwtSecret, { expiresIn: '1h' })
  const cookie = `cms_token=${token}; Path=/; HttpOnly`
  const base = process.env.BASE_URL || 'http://localhost:3000'

  // fetch articles (one page large enough)
  const pageSize = 200
  const res = await fetch(base + '/api/articles?' + new URLSearchParams({ page: '1', pageSize: String(pageSize) }))
  if (!res.ok) return console.error('Failed to list articles', await res.text())
  const json = await res.json()
  const list = Array.isArray(json.data) ? json.data : (json.data || [])
  console.log('Found', list.length, 'articles')

  for (const art of list){
    try{
      const id = art.id
      const content = String(art.content || '').trim()
      if (!content) continue

      // Skip if already structured (headings, lists, blockquotes, figures, tables)
      const hasStructured = /<h[1-6]|<blockquote|<ul|<ol|<figure|<table/i.test(content)
      // detect single paragraph or single long text without multiple <p>
      const pMatches = content.match(/<p[\s\S]*?>[\s\S]*?<\/p>/gi) || []
      const isSingleP = pMatches.length === 1 && content.replace(/<[^>]+>/g,' ').trim().length > 200
      const isBareText = !/<[^>]+>/.test(content) && content.length > 200

      if (hasStructured) {
        // still check for single <p> that is too long (sometimes hasStructured misses)
        if (!isSingleP) { console.log('Skipping', id, '- structured'); continue }
      }

      if (!(isSingleP || isBareText)) { console.log('Skipping', id, '- not a long single paragraph'); continue }

      // Extract inner text
      let inner = content
      if (isSingleP) inner = pMatches[0].replace(/^<p[^>]*>/i,'').replace(/<\/p>$/i,'')
      inner = inner.replace(/<br\s*\/?>/gi,'\n')
      // Strip any remaining tags
      const textOnly = inner.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
      if (textOnly.length < 120) { console.log('Skipping', id, '- too short after cleanup'); continue }

      // Split into paragraphs
      const paras = splitIntoParagraphs(textOnly, 3)
      if (paras.length <= 1) { console.log('Skipping', id, '- could not split into multiple paras'); continue }

      const newHtml = paras.map(p => `<p>${p}</p>`).join('\n\n')
      const payload = Object.assign({}, art, { content: newHtml })
      for (const k of Object.keys(payload)) if (payload[k] === undefined) payload[k] = null

      console.log('Updating', id, '->', paras.length, 'paragraphs')
      const put = await fetch(base + '/api/articles/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: JSON.stringify(payload) })
      const txt = await put.text()
      if (!put.ok) console.error('PUT failed for', id, put.status, txt)
      else console.log('Updated', id)

    }catch(e){ console.error('Error for', art && art.id, e && e.message) }
  }
}

main().catch(e=>{ console.error(e); process.exit(1) })

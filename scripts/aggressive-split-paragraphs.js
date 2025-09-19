const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')

function splitSentencesAggressive(text){
  if (!text) return []
  const norm = text.replace(/\s+/g,' ').trim()
  // Split on sentence enders, but also break on semicolons and long clauses
  let sentences = norm.split(/(?<=[\.\?\!])\s+(?=(?:["'\u201c\u201d\u2018\u2019\(\[])?[A-Z0-9])/g).map(s=>s.trim()).filter(Boolean)
  // further split very long 'sentences' at semicolons or em dashes
  sentences = sentences.flatMap(s => {
    if (s.length > 140) {
      return s.split(/;|\u2014|\u2013|\s\-\s/).map(x=>x.trim()).filter(Boolean)
    }
    return s
  })
  if (sentences.length <= 1) return [norm]
  // group into pairs for tighter paragraphs
  const out = []
  for (let i=0;i<sentences.length;i+=2){
    out.push(sentences.slice(i,i+2).join(' '))
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

      // detect single paragraph or bare text
      const pMatches = content.match(/<p[\s\S]*?>[\s\S]*?<\/p>/gi) || []
      const isSingleP = pMatches.length === 1 && content.replace(/<[^>]+>/g,' ').trim().length > 180
      const isBareText = !/<[^>]+>/.test(content) && content.length > 180

      if (!(isSingleP || isBareText)) { console.log('Skipping', id, '- not target'); continue }

      // Extract inner text
      let inner = content
      if (isSingleP) inner = pMatches[0].replace(/^<p[^>]*>/i,'').replace(/<\/p>$/i,'')
      inner = inner.replace(/<br\s*\/?>/gi,'\n')
      const textOnly = inner.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()
      if (textOnly.length < 80) { console.log('Skipping', id, '- too short'); continue }

      const paras = splitSentencesAggressive(textOnly)
      if (paras.length <= 1) { console.log('Skipping', id, '- nothing to split'); continue }

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

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const jwt = require('jsonwebtoken')

async function main(){
  const cmsFile = path.resolve(process.cwd(), '.cms.json')
  if (!fs.existsSync(cmsFile)) return console.error('.cms.json not found')
  const cms = JSON.parse(fs.readFileSync(cmsFile,'utf8'))
  const token = jwt.sign({ user: cms.username || 'admin' }, cms.jwtSecret, { expiresIn: '1h' })
  const cookie = `cms_token=${token}; Path=/; HttpOnly`
  const base = process.env.BASE_URL || 'http://localhost:3000'
  const id = 20

  console.log('Fetching article', id)
  const r = await fetch(base + '/api/articles/' + id)
  if (!r.ok) return console.error('GET failed', r.status, await r.text())
  const art = await r.json()
  console.log('Original content length:', String(art.content || '').length)

  // Replace pullquote blockquotes with normal paragraphs
  const updated = String(art.content || '').replace(/<blockquote\s+class=(?:"|')pullquote(?:"|')>([\s\S]*?)<\/blockquote>/gi, (m, inner) => {
    return '<p>' + inner.trim() + '</p>'
  })

  if (updated === art.content) return console.log('No pullquote blockquotes found to replace')

  const payload = Object.assign({}, art, { content: updated })
  for (const k of Object.keys(payload)) if (payload[k] === undefined) payload[k] = null

  console.log('Updating article', id)
  const put = await fetch(base + '/api/articles/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Cookie': cookie }, body: JSON.stringify(payload) })
  const txt = await put.text()
  if (!put.ok) console.error('PUT failed', put.status, txt)
  else console.log('Updated article', id)
}

main().catch(e=>{ console.error(e); process.exit(1) })

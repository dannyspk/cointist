const { PrismaClient } = require('@prisma/client')
const fetch = global.fetch || require('node-fetch')
const prisma = new PrismaClient()

const ARTICLE_ID = Number(process.argv[2] || 30)
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY

function escapeHtml(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;') }

async function callOpenAIQuote(title, content){
  if(!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')
  const prompt = `Write a single-sentence, publication-ready quote (30-120 characters) that captures the key insight of this article. Write in the voice of a senior industry analyst or policy expert: concise, authoritative, and non-promotional. Do not attribute the quote to any named outlet or author. Return only the quote text with no surrounding quotes.\nTitle: ${title}\nContent excerpt:\n${(content||'').slice(0,1200)}`
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
  body: JSON.stringify({ model: 'gpt-5-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 120 })
  })
  if(!res.ok){ const t = await res.text(); throw new Error('OpenAI error: '+res.status+' '+t) }
  const json = await res.json()
  const text = (json.choices && json.choices[0] && (json.choices[0].message?.content || json.choices[0].text)) || ''
  return (text||'').trim().replace(/^"|"$/g,'')
}

(async()=>{
  try{
    const article = await prisma.article.findUnique({ where: { id: ARTICLE_ID } })
    if(!article) throw new Error('Article not found: ' + ARTICLE_ID)
    // Use article.content as context
    const plainText = (article.content || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,2000)
    console.log('Requesting OpenAI quote...')
    const quote = await callOpenAIQuote(article.title || '', plainText)
    if(!quote) throw new Error('OpenAI returned empty quote')
  const bq = `<blockquote class=\"generated-quote\"><p>${escapeHtml(quote)}</p><footer>— Senior industry analyst</footer></blockquote>`
    let content = article.content || ''
    // remove any existing blockquotes
    content = content.replace(/<blockquote[\s\S]*?<\/blockquote>/gi,'')
    if(/<\/h2>/i.test(content)){
      content = content.replace(/<\/h2>/i, `</h2>\n  ${bq}`)
    } else if(/<p[^>]*>.*?<\/p>/i.test(content)){
      content = content.replace(/(<p[^>]*>.*?<\/p>)/i, `$1\n  ${bq}`)
    } else {
      content = `${bq}\n${content}`
    }
    const updated = await prisma.article.update({ where: { id: ARTICLE_ID }, data: { content } })
    console.log('Updated article', updated.id, 'with OpenAI quote:')
    console.log(quote)
    // print article JSON
    console.log(JSON.stringify(updated, null, 2))
    await prisma.$disconnect()
  }catch(e){ console.error('Error:', e && e.message); process.exit(2) }
})()

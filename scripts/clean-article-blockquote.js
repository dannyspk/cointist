const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
const { JSDOM } = require('jsdom')
const prisma = new PrismaClient()
const slug = process.argv[2] || 'spacepay-s-presale-introduces-technology-that-could-change-t'

function textFromHtml(html){ try{ const dom = new JSDOM(html); return dom.window.document.body.textContent.replace(/\s+/g,' ').trim() }catch(e){ return '' } }

function generateBlockquoteFromContent(item, scrapedContent, articleData){
  // Reuse logic from pipeline (simplified): pick a clean sentence
  let raw = scrapedContent || ''
  raw = raw.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi,' ')
  raw = raw.replace(/https?:\/\/[^\s]+/gi,' ')
  raw = raw.replace(/\{[\s\S]*?\}|\([^\)]*\)|\[.*?\]/g,' ')
  raw = raw.replace(/[=<>]{2,}|=>|\bfunction\b|\bvar\b|\bconst\b|\bwindow\b|\bdocument\b/gi,' ')
  raw = raw.replace(/[^\w\s\.\,\-\'\"\!\?]/g,' ')
  raw = raw.replace(/\s+/g,' ').trim()
  const sentences = (raw && raw.match(/[^.!?]+[.!?]?/g)) || []
  let quote = ''
  for(const s of sentences){ const t=s.trim(); if(t.length>=40 && t.length<=240 && /[a-zA-Z]/.test(t)) { quote=t; break } }
  if(!quote && sentences.length) quote = sentences.find(s=>/[a-zA-Z]/.test(s)) || sentences[0]
  if(!quote && articleData && articleData.excerpt) quote = articleData.excerpt.split(/\.|\n/)[0].trim()
  if(!quote && item && item.title) quote = item.title
  if(!quote) quote = 'Key developments and insights from this story.'
  if(!/[.!?]$/.test(quote)) quote = quote + '.'
  // escape
  quote = quote.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<blockquote class="generated-quote"><p>${quote}</p><footer>— Cointist</footer></blockquote>`
}

;(async()=>{
  try{
    const a = await prisma.article.findUnique({ where: { slug } })
    if(!a){ console.error('Article not found for slug:', slug); process.exit(1) }
  // Use the article's current HTML content as the source to select a clean sentence
  const scrapedContent = a.content || ''
  const item = { title: a.title }
    const bq = generateBlockquoteFromContent(item, scrapedContent, a)
    let content = a.content || ''
  // remove any existing blockquote elements (be conservative and remove all old quotes)
  content = content.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    // insert after </h2> or after first <p> or prepend
    if(/<\/h2>/i.test(content)){
      content = content.replace(/<\/h2>/i, `</h2>\n  ${bq}`)
    } else if(/<p[^>]*>.*?<\/p>/i.test(content)){
      content = content.replace(/(<p[^>]*>.*?<\/p>)/i, `$1\n  ${bq}`)
    } else {
      content = `${bq}\n${content}`
    }
    const updated = await prisma.article.update({ where: { id: a.id }, data: { content } })
    console.log('Updated article', updated.id)
    await prisma.$disconnect()
  }catch(e){ console.error('Error', e && e.message); process.exit(2) }
})()

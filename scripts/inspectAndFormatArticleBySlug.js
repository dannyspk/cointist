const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const slug = process.argv[2]
if (!slug) {
  console.error('Usage: node inspectAndFormatArticleBySlug.js <slug>')
  process.exit(1)
}

async function main(){
  const a = await prisma.article.findUnique({ where: { slug } })
  if (!a) { console.log('Article not found for slug', slug); return }
  console.log('Found article id', a.id, 'title:', a.title)
  const hasP = /<p[\s>]/i.test(a.content || '')
  console.log('Has <p> tags?', hasP)
  console.log('Excerpt:', a.excerpt)
  // print first 400 chars
  console.log('Content preview:\n', String(a.content || '').slice(0,400))
  // if missing p tags, update to formatted HTML version if available in formatter script
  if (!hasP) {
    console.log('Updating article to formatted HTML...')
    // Basic formatter: wrap paragraphs by splitting on two or more newlines
    const raw = (a.content || '').replace(/\r\n/g,'\n')
    const blocks = raw.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)
    const html = blocks.map(b=>'<p>' + b.replace(/\n/g,' ') + '</p>').join('\n\n')
    await prisma.article.update({ where: { id: a.id }, data: { content: html, updatedAt: new Date() } })
    console.log('Updated article id', a.id)
  } else {
    console.log('No update needed')
  }
}

main().catch(e=>{ console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())

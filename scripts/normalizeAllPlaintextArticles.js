const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main(){
  const all = await prisma.article.findMany({ select: { id: true, slug: true, title: true, content: true } })
  let updated = 0
  for (const a of all){
    const content = String(a.content || '')
    const hasP = /<p[\s>]/i.test(content)
    if (!hasP && content.trim()){
      // simple paragraphization: split on double newlines and wrap in <p>
      const raw = content.replace(/\r\n/g,'\n')
      const blocks = raw.split(/\n{2,}/).map(s=>s.trim()).filter(Boolean)
      const html = blocks.map(b=>'<p>' + b.replace(/\n/g,' ') + '</p>').join('\n\n')
      await prisma.article.update({ where: { id: a.id }, data: { content: html, updatedAt: new Date() } })
      console.log('updated', a.id, a.slug || a.title)
      updated++
    }
  }
  console.log('done, updated', updated)
}

main().catch(e=>{ console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())

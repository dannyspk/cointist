const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const arg = process.argv[2]
if(!arg){ console.error('Usage: node scripts/publish-article.js <id|slug>'); process.exit(1) }
const isId = /^\d+$/.test(arg)

;(async()=>{
  try{
    let article
    if(isId){
      article = await prisma.article.findUnique({ where: { id: Number(arg) } })
    }else{
      article = await prisma.article.findUnique({ where: { slug: arg } })
    }
    if(!article){ console.error('Article not found:', arg); process.exit(2) }
    const updated = await prisma.article.update({ where: { id: article.id }, data: { published: true, publishedAt: new Date() } })
    console.log('Published article', updated.id, updated.slug, 'publishedAt=', updated.publishedAt)
    await prisma.$disconnect()
  }catch(e){ console.error('Error publishing article:', e && e.message); process.exit(3) }
})()

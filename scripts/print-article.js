const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const slug = process.argv[2] || 'spacepay-s-presale-introduces-technology-that-could-change-t'

;(async()=>{
  try{
    const a = await prisma.article.findUnique({ where: { slug } })
    if(!a){ console.error('Article not found for slug:', slug); process.exit(1) }
    console.log(JSON.stringify(a, null, 2))
    await prisma.$disconnect()
  }catch(e){ console.error('Error querying prisma:', e && e.message); process.exit(2) }
})()

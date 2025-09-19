const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main(){
  const all = await prisma.article.findMany({ select: { id: true, author: true } })
  console.log('found', all.length, 'articles')
  let count = 0
  for (const a of all){
    if (a.author !== 'Cointist'){
      await prisma.article.update({ where: { id: a.id }, data: { author: 'Cointist', updatedAt: new Date() } })
      count++
      console.log('updated', a.id)
    }
  }
  console.log('done, updated', count)
}

main().catch(e=>{ console.error(e); process.exit(1) }).finally(()=>prisma.$disconnect())

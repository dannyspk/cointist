const { PrismaClient } = require('@prisma/client');
(async function(){
  const prisma = new PrismaClient();
  try{
    const before = await prisma.article.findUnique({ where: { id: 36 } });
    console.log('Before:', { id: before.id, coverImage: before.coverImage, thumbnail: before.thumbnail });
    await prisma.article.update({ where: { id: 36 }, data: { coverImage: '/assets/images/pexels-3989914-cover.webp', thumbnail: '/assets/images/pexels-3989914-thumb.webp' } });
    const after = await prisma.article.findUnique({ where: { id: 36 } });
    console.log('After:', { id: after.id, coverImage: after.coverImage, thumbnail: after.thumbnail });
  }catch(e){
    console.error('Error', e && e.message)
  }finally{
    await prisma.$disconnect()
  }
})()

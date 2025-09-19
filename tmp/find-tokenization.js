const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient();
  try{
    const all = await prisma.article.findMany();
    const matches = all.filter(a=> a.title && a.title.toLowerCase().includes('tokenization'));
    console.log('Total articles:', all.length);
    console.log('Matches:', matches.map(m=>({ id: m.id, title: m.title }))); 
  }catch(e){ console.error(e && e.message); }
  finally{ await prisma.$disconnect(); }
})();

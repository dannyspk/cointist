const prisma = require('../node_modules/.prisma/client') || require('@prisma/client');
(async ()=>{
  try{
    const { PrismaClient } = require('@prisma/client');
    const client = new PrismaClient();
    const items = await client.article.findMany({ orderBy: [{ createdAt: 'desc' }], take: 20 });
    console.log('Found', items.length, 'articles');
    items.forEach(it => console.log(it.id, it.title, it.published, it.featuredOnly));
    await client.$disconnect();
  }catch(e){ console.error('Error listing articles', e); process.exit(1); }
})();

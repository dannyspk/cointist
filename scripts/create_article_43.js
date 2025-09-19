const prisma = require('../node_modules/.prisma/client').PrismaClient ? new (require('@prisma/client').PrismaClient)() : new (require('@prisma/client').PrismaClient)();

async function main(){
  try{
    // attempt to find id 43
    const existing = await prisma.article.findUnique({ where: { id: 43 } }).catch(()=>null);
    if (existing) {
      console.log('Article 43 already exists');
      console.log(existing);
      process.exit(0);
    }
    const created = await prisma.article.create({ data: {
      title: 'Test Featured Article 43',
      slug: 'test-featured-article-43-' + Date.now(),
      category: 'News',
      author: 'DevScript',
      excerpt: 'A short excerpt for article 43',
      content: '<p>Test content</p>',
      published: false,
      thumbnail: '/assets/press1.webp',
      coverImage: '/assets/hero-eth4k.webp',
      tags: []
    } });
    console.log('Created', created.id);
    process.exit(0);
  } catch (e) {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
  }
}

main();

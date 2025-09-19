const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function main(){
  const items = await prisma.article.findMany({ where: { category: 'News', subcategory: 'latest', published: true }, orderBy: { publishedAt: 'desc' }, take: 10 });
  console.log('found', items.length);
  items.forEach(it=> console.log(it.id, it.title, it.subcategory, it.published));
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });

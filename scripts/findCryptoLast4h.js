const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function main(){
  const since = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const items = await prisma.article.findMany({ where: { published: true, publishedAt: { gte: since } }, orderBy: { publishedAt: 'desc' }, take: 200 });
  const needle = 'crypto';
  const matches = items.filter(it => {
    try{
      if (!it) return false;
      const hay = [it.title, it.excerpt, it.category, it.subcategory, JSON.stringify(it.tags || [])].filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(needle) !== -1;
    }catch(e){ return false }
  });
  console.log('Found', matches.length, 'items in last 4 hours matching "crypto"');
  matches.forEach(it=>{
    console.log('---');
    console.log('id:', it.id);
    console.log('title:', it.title);
    console.log('slug:', it.slug);
    console.log('publishedAt:', it.publishedAt);
    console.log('category:', it.category, 'subcategory:', it.subcategory, 'tags:', JSON.stringify(it.tags));
    console.log('thumbnail:', it.thumbnail || it.coverImage || '');
  });
  process.exit(0);
}

main().catch(e=>{ console.error(e); process.exit(1); });

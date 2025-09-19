const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const titleArg = process.argv[2];
if (!titleArg) {
  console.error('Usage: node tmp/update-article-by-title.js "Article Title or slug"');
  process.exit(1);
}

function safeFilename(title){
  return String(title || '').toLowerCase().replace(/[^a-z0-9\s-_.]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/(^-|-$)/g,'');
}

(async ()=>{
  try{
    const q = titleArg;
    // try slug match first
    let item = await prisma.article.findFirst({ where: { OR: [ { slug: q }, { title: q } ] } });
    if (!item) {
      // try case-insensitive title search
      const lower = q.toLowerCase();
      item = await prisma.article.findFirst();
      // fallback: search all and match by lowercased title
      const all = await prisma.article.findMany();
      item = all.find(a => (a.title && String(a.title).toLowerCase() === lower) || (a.slug && String(a.slug).toLowerCase() === lower));
    }
    if (!item) {
      console.error('Article not found for:', q);
      process.exit(2);
    }
    console.log('Found article:', { id: item.id, title: item.title, slug: item.slug });
    const base = safeFilename(item.slug || item.title || titleArg);
    const cover = `/assets/${base}-cover.jpg`;
    const thumb = `/assets/${base}-thumb.jpg`;
    console.log('Updating images to:', { cover, thumb });
    const before = { coverImage: item.coverImage, thumbnail: item.thumbnail };
    const updated = await prisma.article.update({ where: { id: item.id }, data: { coverImage: cover, thumbnail: thumb } });
    console.log('Before:', before);
    console.log('After:', { coverImage: updated.coverImage, thumbnail: updated.thumbnail });
  }catch(e){
    console.error('Error', e && e.message);
    process.exitCode = 1;
  }finally{
    await prisma.$disconnect();
  }
})();

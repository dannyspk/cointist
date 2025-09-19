const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const prisma = new PrismaClient();
  try{
    const id = 40;
    const item = await prisma.article.findUnique({ where: { id } });
    if (!item) {
      console.error('Article not found:', id);
      process.exit(2);
    }
    const raw = item.slug || item.title || '';
    const safe = String(raw).toLowerCase().replace(/[^a-z0-9\s-_.]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/(^-|-$)/g,'');
    const cover = `/assets/${safe}-cover.jpg`;
    const thumb = `/assets/${safe}-thumb.jpg`;
    console.log('Updating article', id, '->', { cover, thumb });
    const before = { coverImage: item.coverImage, thumbnail: item.thumbnail };
    const updated = await prisma.article.update({ where: { id }, data: { coverImage: cover, thumbnail: thumb } });
    console.log('Before:', before);
    console.log('After:', { coverImage: updated.coverImage, thumbnail: updated.thumbnail });
  }catch(e){
    console.error('Error', e && e.message);
    process.exitCode = 1;
  }finally{
    await prisma.$disconnect();
  }
})();

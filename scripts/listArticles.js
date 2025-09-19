const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const p = new PrismaClient();
  try{
    const all = await p.article.findMany({ orderBy: { id: 'asc' } });
    if (!all.length) { console.log('No articles'); return; }
    console.log('Articles:');
    all.forEach(a=>{
      console.log(`id=${a.id}\ttitle="${a.title}"\tslug="${a.slug}"\tauthor="${a.author || ''}"\tpublished=${a.published}\tpublishedAt=${a.publishedAt}\tcreatedAt=${a.createdAt}\tupdatedAt=${a.updatedAt}\tthumbnail=${a.thumbnail || 'null'}\ttags=${a.tags ? JSON.stringify(a.tags) : 'null'}`);
    });
  } catch(e){ console.error(e); process.exitCode=1; }
  finally{ await p.$disconnect(); }
})();

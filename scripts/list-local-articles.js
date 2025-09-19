#!/usr/bin/env node
const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function main(){
  try{
    const items = await prisma.article.findMany({ orderBy: { id: 'asc' }, take: 200 });
    console.log('COUNT', items.length);
    console.log(items.map(a => ({ id: a.id, slug: a.slug, title: a.title, coverImage: a.coverImage, thumbnail: a.thumbnail })).slice(-20));
  }catch(e){
    console.error('Error', e && e.message ? e.message : e);
    process.exit(1);
  } finally{
    await prisma.$disconnect().catch(()=>{});
  }
}

main();

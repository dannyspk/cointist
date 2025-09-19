#!/usr/bin/env node
// Read local Prisma article by slug or id and print coverImage/thumbnail
const prisma = require('../src/lib/prisma').default || require('../src/lib/prisma');

async function main(){
  const slug = process.argv[2] || 'crypto-pr-campaign';
  try{
    const art = await prisma.article.findUnique({ where: { slug } });
    console.log(JSON.stringify(art, null, 2));
  }catch(e){
    console.error('Error reading local prisma article:', e && e.message ? e.message : e);
    process.exit(1);
  } finally{
    await prisma.$disconnect().catch(()=>{});
  }
}

main();

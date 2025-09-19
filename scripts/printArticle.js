const { PrismaClient } = require('@prisma/client');
(async function(){
  const p = new PrismaClient();
  try{
    const a = await p.article.findFirst();
    if (!a) { console.log('No articles found'); return; }
    console.log('keys:', Object.keys(a));
    console.log('sample:', JSON.stringify(a, null, 2));
  } catch(e){
    console.error(e);
    process.exitCode = 1;
  } finally{
    await p.$disconnect();
  }
})();

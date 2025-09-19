const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const p = new PrismaClient();
  try{
    const all = await p.article.findMany({ orderBy: { createdAt: 'asc' } });
    if (!all.length) { console.log('No articles'); return; }
    const bySlug = all.reduce((acc,a)=>{ acc[a.slug] = acc[a.slug]||[]; acc[a.slug].push(a); return acc; }, {});
    const byTitle = all.reduce((acc,a)=>{ acc[a.title] = acc[a.title]||[]; acc[a.title].push(a); return acc; }, {});
    console.log('\nDuplicates by slug:');
    Object.entries(bySlug).forEach(([k,arr])=>{ if (arr.length>1) { console.log(`\nSLUG: ${k} -> ${arr.length}`); arr.forEach(a=>console.log(`  id=${a.id} title="${a.title}" createdAt=${a.createdAt} published=${a.published}`)); } });
    console.log('\nDuplicates by title:');
    Object.entries(byTitle).forEach(([k,arr])=>{ if (arr.length>1) { console.log(`\nTITLE: ${k} -> ${arr.length}`); arr.forEach(a=>console.log(`  id=${a.id} slug="${a.slug}" createdAt=${a.createdAt} published=${a.published}`)); } });
  } catch(e){ console.error(e); process.exitCode=1; }
  finally{ await p.$disconnect(); }
})();

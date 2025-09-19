const { PrismaClient } = require('@prisma/client');
(async ()=>{
  const p = new PrismaClient();
  try{
    const all = await p.article.findMany({ orderBy: { createdAt: 'asc' } });
    if (!all.length) { console.log('No articles'); return; }
    // group by title|slug|content normalized
    const groups = {};
    all.forEach(a=>{
      const key = JSON.stringify({ title: a.title||'', slug: a.slug||'', content: (a.content||'').replace(/\s+/g,' ').trim() });
      groups[key] = groups[key] || [];
      groups[key].push(a);
    });
    let found = 0;
    console.log('\nDuplicate groups (by title+slug+content):\n');
    Object.values(groups).forEach(arr=>{
      if (arr.length > 1) {
        found++;
        console.log('--- Group ---');
        arr.forEach(a=>{
          console.log(`id=${a.id} title="${a.title}" slug="${a.slug}" createdAt=${a.createdAt} updatedAt=${a.updatedAt} published=${a.published}`);
        });
        // suggest keep newest (last by createdAt)
        const keep = arr.reduce((best,c)=> new Date(c.createdAt) > new Date(best.createdAt) ? c : best, arr[0]);
        const remove = arr.filter(x=>x.id !== keep.id);
        console.log(`Suggest keeping id=${keep.id} (newest). Would remove: ${remove.map(x=>x.id).join(', ')}`);
        console.log('');
      }
    });
    if (!found) console.log('No duplicate groups found.');
  } catch(e){ console.error(e); process.exitCode=1; }
  finally{ await p.$disconnect(); }
})();

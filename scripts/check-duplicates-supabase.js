#!/usr/bin/env node
require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async function main(){
  try{
    const { data, error } = await supa.from('Article').select('id,slug,title,excerpt,published,publishedAt,createdAt,updatedAt,coverImage,thumbnail').eq('category','Opinions').order('publishedAt',{ascending:false}).limit(200);
    if (error) { console.error('Supabase error', error); process.exit(1); }
    if (!data || data.length===0) { console.log('No Opinions found'); process.exit(0); }
    const byTitle = {};
    const bySlug = {};
    data.forEach(a => {
      const t = (a.title||'').trim();
      const s = (a.slug||'').trim();
      if (!byTitle[t]) byTitle[t]=[];
      byTitle[t].push(a);
      if (!bySlug[s]) bySlug[s]=[];
      bySlug[s].push(a);
    });
    console.log('Total Opinions:', data.length);
    console.log('\nDuplicates by slug:');
    for (const s of Object.keys(bySlug)){
      if (bySlug[s].length>1) console.log(s, bySlug[s].map(x=>({id:x.id, title:x.title, published:x.published, publishedAt:x.publishedAt, updatedAt:x.updatedAt})));
    }
    console.log('\nDuplicates by title:');
    for (const t of Object.keys(byTitle)){
      if (byTitle[t].length>1) console.log(t, byTitle[t].map(x=>({id:x.id, slug:x.slug, published:x.published, publishedAt:x.publishedAt, updatedAt:x.updatedAt})));
    }
    console.log('\nFull list:');
    data.forEach(x=> console.log({id:x.id,slug:x.slug,title:x.title,coverImage:!!x.coverImage,thumbnail:!!x.thumbnail, published:x.published, publishedAt:x.publishedAt,updatedAt:x.updatedAt}));
  }catch(e){ console.error('Exception', e && e.message ? e.message : e); process.exit(1); }
})();

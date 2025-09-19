#!/usr/bin/env node
require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main(){
  const art = {
    id: 41,
    slug: 'bitcoin-dead-opinion',
    title: "Crypto’s Greatest PR Campaign: Why Declaring Bitcoin Dead Keeps It Alive",
    category: 'Opinions',
    author: 'Cointist',
    excerpt: "If Bitcoin had a marketing department, it couldn't have scripted a better funnel...",
    content: `\n<div class="tag">Opinion</div>\n<h2>Crypto’s Greatest PR Campaign</h2>\n<p>Article content placeholder.</p>\n`,
    published: true,
    publishedAt: new Date().toISOString(),
    pinned: true,
    coverImage: null,
    thumbnail: null,
    coverAlt: null,
    thumbnailAlt: null
  };

  try{
    const { data, error } = await supa.from('Article').upsert([art], { onConflict: 'slug' }).select();
    if (error) {
      console.error('Upsert error', error);
      process.exit(1);
    }
    console.log('Upsert result:', data && data[0] ? data[0] : data);
  }catch(e){
    console.error('Exception', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main();

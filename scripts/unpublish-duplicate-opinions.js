#!/usr/bin/env node
// Unpublish duplicate Opinions articles except the canonical id (41)
require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main(){
  const duplicateIds = [1,2]; // leave id 41 published
  try{
    const { data, error } = await supa.from('Article').update({ published: false }).in('id', duplicateIds).select();
    if (error) { console.error('Update error', error); process.exit(1); }
    console.log('Unpublished:', data.map(d=>({id:d.id,slug:d.slug,published:d.published})));
  }catch(e){ console.error('Exception', e && e.message ? e.message : e); process.exit(1); }
}

main();

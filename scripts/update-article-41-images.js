#!/usr/bin/env node
require('dotenv').config({ path: '.vercel.env' });
const { createClient } = require('@supabase/supabase-js');
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main(){
  const cover = "/uploads/1756079634753-20250825_0341_Bitcoin's-Resilient-Revival_simple_compose_01k3f3svwfej08yv5qrwrqs4b5.png";
  const thumb = "/uploads/1756079636200-20250825_0341_Bitcoin's-Resilient-Revival_simple_compose_01k3f3svwfej08yv5qrwrqs4b5.png";
  try{
    const { data, error } = await supa.from('Article').update({ coverImage: cover, thumbnail: thumb }).eq('id', 41).select();
    if (error) { console.error('Update error', error); process.exit(1); }
    console.log('Updated:', data && data[0] ? data[0] : data);
  }catch(e){ console.error('Exception', e && e.message ? e.message : e); process.exit(1); }
}

main();

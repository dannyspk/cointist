#!/usr/bin/env node
// List featured guides from Supabase (featuredOnly = true)
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.');
  process.exit(2);
}

const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main(){
  try{
  // select all columns so we can inspect table shape (avoid referencing columns that may not exist)
  const { data, error } = await supa.from('Guides').select('*').eq('featuredOnly', true).order('id', { ascending: true }).limit(50);
    if (error) {
      console.error('Supabase error:', error);
      process.exit(3);
    }
    if (!data || !data.length) {
      console.log('No featured guides found.');
      return;
    }
  // Print rows and also print column keys to make schema visible
  console.log('Columns present on Guides rows:', Object.keys(data[0] || {}));
  console.log(JSON.stringify(data, null, 2));
  }catch(e){
    console.error('Unexpected error', e && e.message ? e.message : e);
    process.exit(99);
  }
}

main();

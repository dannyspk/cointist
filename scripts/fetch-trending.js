#!/usr/bin/env node
/*
  Fetch latest trending crypto/blockchain articles (legacy script).

  NOTE: The project no longer relies on NewsAPI for the weekly report.
  News should be stored in the Supabase `articles` table and the report
  generator will query that instead. This script is kept only for
  historical/debugging purposes and still uses NewsAPI if a key is set.
*/

const fetch = require('node-fetch');

function isoNow(){ return new Date().toISOString(); }
function isoHoursAgo(h){ return new Date(Date.now() - h * 3600 * 1000).toISOString(); }

async function main(){
  const key = process.env.NEWSAPI_KEY;
  if (!key){
    console.error('ERROR: NEWSAPI_KEY environment variable is required.');
    console.error('Get a key from https://newsapi.org/ and set NEWSAPI_KEY=your_key');
    process.exit(2);
  }

  const q = encodeURIComponent('crypto OR blockchain');
  const from = encodeURIComponent(isoHoursAgo(6));
  const to = encodeURIComponent(isoNow());
  const pageSize = 100;
  const url = `https://newsapi.org/v2/everything?q=${q}&from=${from}&to=${to}&language=en&sortBy=publishedAt&pageSize=${pageSize}`;

  try {
    const res = await fetch(url, { headers: { 'X-Api-Key': key } });
    if (!res.ok) {
      const body = await res.text();
      console.error('NewsAPI error:', res.status, res.statusText);
      console.error(body);
      process.exit(3);
    }
    const json = await res.json();

    // print a compact list of results
    console.log(`Found ${json.totalResults || (json.articles||[]).length} articles (last 6 hours)`);
    const list = (json.articles || []).map(a => ({
      title: a.title,
      source: a.source && a.source.name,
      publishedAt: a.publishedAt,
      url: a.url
    }));

    list.forEach((it, i) => {
      console.log(`${i+1}. ${it.title}`);
      console.log(`   ${it.source} • ${it.publishedAt}`);
      console.log(`   ${it.url}`);
    });

    // also dump the raw JSON to a separate file if requested via --out=<path>
    const outArg = process.argv.find(a => a.startsWith('--out='));
    if (outArg){
      const outPath = outArg.split('=')[1];
      const fs = require('fs');
      fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf8');
      console.error(`Wrote raw JSON to ${outPath}`);
    }

  } catch (e){
    console.error('Fetch failed:', e && e.message || e);
    process.exit(4);
  }
}

if (require.main === module) main();

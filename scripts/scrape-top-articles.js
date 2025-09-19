#!/usr/bin/env node
/*
  Scrape top N articles from the aggregator JSON and extract main content text.
  Usage: node scripts/scrape-top-articles.js --in=./tmp/trending.json --count=10 --out=./tmp/top10-scraped.json
*/
const fs = require('fs');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const argv = require('minimist')(process.argv.slice(2));

function textFromNode(node){
  if (!node) return '';
  // get visible text only
  return node.textContent.replace(/\s+/g,' ').trim();
}

function isSocialSourceItem(item){
  // try url hostname first
  try{
    const u = new URL(item.url);
    const host = (u.hostname || '').toLowerCase();
    if (host.includes('reddit')) return true;
    if (host === 'x.com' || host.includes('x.com')) return true;
    if (host.includes('twitter') || host === 't.co' || host.includes('t.co')) return true;
  }catch(e){
    // fall through to source field check
  }
  const src = (item.source || '').toString().toLowerCase();
  if (!src) return false;
  if (src.includes('reddit')) return true;
  if (src.includes('twitter') || src === 'x') return true;
  if (src.includes('x.com')) return true;
  return false;
}

async function fetchAndExtract(url){
  try{
    const res = await fetch(url, { headers: { 'User-Agent': 'cointist-scraper/1.0' }, timeout: 15000 });
    if (!res.ok) return { url, error: `HTTP ${res.status}` };
    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    // common article selectors
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',
      '.story-body'
    ];
    for (const sel of selectors){
      const el = doc.querySelector(sel);
      if (el){
        const text = textFromNode(el);
        if (text && text.length > 200) return { url, content: text, selector: sel };
      }
    }
    // fallback: collect largest continuous <p> block
    const pNodes = Array.from(doc.querySelectorAll('p'));
    if (pNodes.length){
      // group adjacent ps into blocks by parent
      const blocks = new Map();
      pNodes.forEach(p => {
        const key = p.parentElement ? p.parentElement.outerHTML.slice(0,200) : 'root';
        const prev = blocks.get(key) || [];
        prev.push(p);
        blocks.set(key, prev);
      });
      // find block with largest text
      let best = { text: '', size: 0 };
      blocks.forEach((ps, k) => {
        const txt = ps.map(p => textFromNode(p)).join('\n\n');
        if (txt.length > best.size) best = { text: txt, size: txt.length };
      });
      if (best.size > 200) return { url, content: best.text, selector: 'p-block' };
    }
    // last resort: body text
    const bodyText = textFromNode(doc.body || doc.documentElement);
    return { url, content: bodyText.slice(0, 2000), selector: 'body-fallback' };
  } catch (e){
    return { url, error: e && e.message || String(e) };
  }
}

async function main(){
  const inPath = argv.in || './tmp/trending.json';
  const outPath = argv.out || './tmp/top10-scraped.json';
  const count = Number(argv.count || 10);
  if (!fs.existsSync(inPath)) { console.error('Input file not found:', inPath); process.exit(2); }
  const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
  // exclude social aggregator posts from X/Twitter and Reddit
  const excluded = raw.filter(isSocialSourceItem);
  const filtered = raw.filter(r => !isSocialSourceItem(r));
  if (excluded.length) console.error(`Excluded ${excluded.length} items from X/Twitter/Reddit; proceeding with ${filtered.length}`);
  const top = filtered.slice(0, count);
  const results = [];
  for (const it of top){
  const target = (it.orig_url && it.orig_url.length) ? it.orig_url : it.url
  console.error('Fetching:', target, ' (meta.url=', it.url, ')');
  const scraped = await fetchAndExtract(target);
    results.push({ meta: it, scraped });
  }
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Wrote ${results.length} items to ${outPath}`);
  // also print a compact summary
  results.forEach((r, i) => {
    console.log('\n---');
    console.log(`${i+1}. ${r.meta.title}`);
    console.log(`${r.meta.source} • ${r.meta.publishedAt}`);
    console.log(`${r.meta.url}`);
    if (r.scraped.error) console.log('Error:', r.scraped.error);
    else console.log('Content (first 800 chars):\n', r.scraped.content.slice(0,800).replace(/\n+/g,'\n'));
  });
}

main();

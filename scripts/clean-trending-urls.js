#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function isImageUrl(u){
  if(!u) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(u) || /images?\.|cdn\./i.test(u);
}

function extractFromSummary(summary){
  if(!summary) return null;
  const m = summary.match(/href=["']([^"']+)["']/i);
  if(m && m[1]) return m[1];
  return null;
}

function looksLikeGoogleEncrypted(u){
  if(!u) return false;
  try{
    const lo = u.toLowerCase();
    if(lo.includes('news.google.com') || lo.includes('news.google.com/rss')) return true;
    if(lo.includes('encrypted-tbn') || lo.includes('googleusercontent.com')) return true;
  }catch(e){ }
  return false;
}

function isLikelyEnglish(text){
  if(!text) return false;
  const s = String(text);
  const englishWords = /\b(the|and|in|of|for|with|on|is|are|by|to|from|as|that)\b/i;
  if(englishWords.test(s)) return true;
  // fallback: ascii ratio
  const chars = s.replace(/\s+/g,'');
  if(!chars) return false;
  const ascii = [...chars].filter(c=> c.charCodeAt(0) < 128).length;
  return (ascii / chars.length) > 0.9;
}

function chooseUrl(item){
  // prefer orig_url if it looks like an article link (not an image)
  if(item.orig_url && !isImageUrl(item.orig_url) && !looksLikeGoogleEncrypted(item.orig_url)) return {url: item.orig_url, from: 'orig_url'};
  // if orig_url is image, skip it
  if(item.url && !looksLikeGoogleEncrypted(item.url)) return {url: item.url, from: 'url'};
  // try to find a link in the summary that isn't a google link
  const maybe = extractFromSummary(item.summary);
  if(maybe && !looksLikeGoogleEncrypted(maybe)) return {url: maybe, from: 'summary'};
  // last resort: if id is a URL and not google
  if(item.id && String(item.id).startsWith('http') && !looksLikeGoogleEncrypted(item.id)) return {url: item.id, from: 'id'};
  return null;
}

function main(){
  const inPath = path.resolve(__dirname, '..', 'tmp', 'trending-aggregator-last.json');
  const outPath = path.resolve(__dirname, '..', 'tmp', 'trending-original-urls.json');
  if(!fs.existsSync(inPath)){
    console.error('Input not found:', inPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(inPath, 'utf8');
  let items = [];
  try{ items = JSON.parse(raw); }catch(e){ console.error('parse error', e && e.message); process.exit(1);} 

  const kept = [];
  const removed = [];
  for(const it of items){
    const chosen = chooseUrl(it);
    if(!chosen){
      removed.push({item: it, reason: 'no-non-google-url'});
      continue;
    }
    // language filter: prefer title then summary
    const text = it.title || it.summary || '';
    if(!isLikelyEnglish(text)){
      removed.push({item: it, reason: 'non-english'});
      continue;
    }
    kept.push({source: it.source||null, title: it.title||null, url: chosen.url, derivedFrom: chosen.from, publishedAt: it.publishedAt||null});
  }

  fs.writeFileSync(outPath, JSON.stringify(kept, null, 2), 'utf8');
  console.log(`Scanned ${items.length} records -> kept ${kept.length}, removed ${removed.length}`);
  // write removed short report
  const remReport = path.resolve(__dirname, '..', 'tmp', 'trending-removed-report.json');
  fs.writeFileSync(remReport, JSON.stringify(removed.slice(0,200), null, 2), 'utf8');
  console.log('Wrote cleaned URLs to', outPath);
}

if(require.main===module) main();

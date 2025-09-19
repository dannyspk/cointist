const fs=require('fs');
const data=JSON.parse(fs.readFileSync('tmp/test-trending.json','utf8'));
console.log('total', data.length);
const counts={};
for(const it of data){ counts[it.source]=(counts[it.source]||0)+1; }
const keys=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
console.log('sources:'); for(const k of keys) console.log('  ',k,':',counts[k]);
const binItems=data.filter(it=>it.source && it.source.startsWith('binance-'));
console.log('\nbinance-* items:', binItems.length);
if(binItems.length){ console.log('example binance items:'); binItems.slice(0,10).forEach(it=>console.log(' -', it.source, '|', it.title, '|', it.url)); }
const myxMatches = data.filter(it=> ((it.title||'')+ ' ' + (it.summary||'') + ' ' + (it.url||'')).toLowerCase().includes('myx'));
console.log('\nMYX matches:', myxMatches.length);
if(myxMatches.length){ myxMatches.slice(0,10).forEach(it=>console.log(' -', it.source, '|', it.title, '|', it.url)); }

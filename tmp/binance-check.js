const fs = require('fs');
const { PorterStemmer } = require('natural');
const p = 'tmp/trending-aggregator-last.json';
if (!fs.existsSync(p)) { console.error('MISSING', p); process.exit(2); }
const a = JSON.parse(fs.readFileSync(p, 'utf8'));
const bin = a.filter(x => String(x.source || '').toLowerCase().startsWith('binance-'));
console.log('BINANCE_COUNT:' + bin.length);
bin.slice(0, 8).forEach((b, i) => {
  console.log('\n#' + (i + 1), b.source, '-', (b.title || '').replace(/\n/g, ' '));
  console.log('  url:', b.url);
  // simulate server-side injection of binance base symbol
  const stems = (b.stems || []).map(s => String(s||'')).slice(0,12);
  // compute injected stem if missing
  let injected = null;
  const s = String(b.source || '').toLowerCase();
  if (s.startsWith('binance-')) {
    const parts = s.split('-');
    if (parts.length >= 2) {
      const base = parts.slice(1).join('-');
      const cleanBase = String(base || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanBase) injected = PorterStemmer.stem(cleanBase);
    }
  }
  const final = stems.slice();
  if (injected && !final.map(x=>x.toLowerCase()).includes(injected)) final.push(injected);
  console.log('  stems(raw):', stems);
  console.log('  injected(stem):', injected);
  console.log('  stems(final):', final);
});

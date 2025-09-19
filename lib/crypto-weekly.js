const https = require('https');
const fs = require('fs');
const path = require('path');

function getJson(url, options = {}){
  return new Promise((resolve,reject)=>{
    let data='';
    https.get(url, options, (res)=>{
      res.on('data', c=>data+=c);
      res.on('end', ()=>{
        try{ if(res.statusCode>=200 && res.statusCode<300) return resolve(JSON.parse(data));
             return reject(new Error(`Fetch failed ${res.statusCode}`));
        }catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

// helpers: sma, rsi, detectSignals, buildPriceSummary, buildNarrative (copied/adapted from btc-weekly)
function sma(values, period){ if(!Array.isArray(values) || values.length<period) return null; const out=[]; for(let i=0;i<=values.length-period;i++){ const slice=values.slice(i,i+period); out.push(slice.reduce((a,b)=>a+b,0)/period); } return out; }
function rsi(values, period=14){ if(!Array.isArray(values) || values.length<=period) return null; const deltas=[]; for(let i=1;i<values.length;i++) deltas.push(values[i]-values[i-1]); let gains=0, losses=0; for(let i=0;i<period;i++){ const d=deltas[i]; if(d>0) gains+=d; else losses-=d; } let avgGain=gains/period, avgLoss=losses/period; for(let i=period;i<deltas.length;i++){ const d=deltas[i]; if(d>0){ avgGain = (avgGain*(period-1) + d)/period; avgLoss = (avgLoss*(period-1))/period; } else { avgLoss = (avgLoss*(period-1) - d)/period; avgGain = (avgGain*(period-1))/period; } } if(avgLoss===0) return 100; const rs=avgGain/avgLoss; return 100 - (100/(1+rs)); }

function detectSignals(prices, volumes=[]){
  if(!Array.isArray(prices) || prices.length===0) return null;
  const last = prices[prices.length-1]; const first = prices[0]; const change = ((last-first)/first)*100;
  const sma8 = sma(prices,8); const sma21 = sma(prices,21);
  const lastSMA8 = sma8 ? sma8[sma8.length-1] : null; const lastSMA21 = sma21 ? sma21[sma21.length-1] : null;
  const r = rsi(prices,14);
  const volMedian = Array.isArray(volumes) && volumes.length ? volumes.slice().sort((a,b)=>a-b)[Math.floor(volumes.length/2)] || 0 : 0;
  const volumeSpike = Array.isArray(volumes) && volumes.length ? (volumes[volumes.length-1] > volMedian * 2.5) : false;
  const recent = prices.slice(-24); let sweep=false; let maxDropPct=0;
  for(let i=0;i<recent.length;i++) for(let j=i+1;j<recent.length;j++){ const drop = (recent[i]-recent[j])/recent[i]*100; if(drop>maxDropPct) maxDropPct = drop; }
  if(maxDropPct>2.5) sweep=true;
  const peaks=[]; for(let i=2;i<prices.length-2;i++){ if(prices[i]>prices[i-1] && prices[i]>prices[i+1]) peaks.push(prices[i]); }
  const lastPeaks = peaks.slice(-3); const lowerHighs = lastPeaks.length>=3 && lastPeaks[0]>lastPeaks[1] && lastPeaks[1]>lastPeaks[2];
  return { last, change, rsi: r, lastSMA8, lastSMA21, volumeSpike, sweep, maxDropPct, lowerHighs };
}

function buildPriceSummary(prices){ const first = prices[0]; const last = prices[prices.length-1]; const min = Math.min(...prices); const max = Math.max(...prices); const change = ((last-first)/first)*100; return `First: $${first.toLocaleString(undefined,{maximumFractionDigits:2})}\nLast:  $${last.toLocaleString(undefined,{maximumFractionDigits:2})}\nLow:   $${min.toLocaleString(undefined,{maximumFractionDigits:2})}\nHigh:  $${max.toLocaleString(undefined,{maximumFractionDigits:2})}\nChange: ${change.toFixed(2)}%`; }

function buildNarrative(signals){
  if(!signals) return '';
  let last7Analysis = '';
  if(signals.sweep) last7Analysis += `A fast liquidity sweep (~${signals.maxDropPct.toFixed(1)}% drop) occurred during the week, grabbing stops before the partial recovery.`;
  if(signals.lowerHighs) last7Analysis += ` Structure shows lower highs across recent peaks, which favors bearish continuation unless reclaimed.`;
  if(signals.volumeSpike) last7Analysis += ` A notable volume spike on the latest bar signals conviction behind the move.`;
  if(!last7Analysis) last7Analysis = 'Price action was mixed over the past week with modest net change and no dominant directional conviction.';
  return last7Analysis;
}

// Fetch top-10 coins from CoinGecko with sparkline data.
// Request 11 results and skip Lido Staked Ether (STETH) so rank-11 fills the slot when STETH appears.
async function fetchTop10Coins(){
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=11&page=1&sparkline=true&price_change_percentage=7d';
  try{
    const parsed = await getJson(url, { headers: { 'User-Agent':'node.js','Accept':'application/json' } });
    if(Array.isArray(parsed)){
      const out = [];
      for(const item of parsed){
        if(out.length >= 10) break;
        const id = String(item.id || '').toLowerCase();
        const sym = String(item.symbol || '').toLowerCase();
        if(id === 'staked-ether' || id === 'steth' || sym === 'steth'){
          // skip Lido Staked Ether
          continue;
        }
        out.push(item);
      }
      // fallback: if we couldn't build 10 (rare), return first 10 from parsed
      if(out.length < 10) return parsed.slice(0,10);
      return out;
    }
  }catch(e){ console.warn('fetchTop10Coins failed', e && e.message); }
  return [];
}

// Try to fetch Binance 7d klines for a symbol (symbol like BTCUSDT)
async function fetchBinance7dForSymbol(symbol){
  try{
    const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=168`;
    const parsed = await getJson(url, { headers:{ 'User-Agent':'node.js','Accept':'application/json' } });
    const prices = parsed.map(k=>Number(k[4]));
    const volumes = parsed.map(k=>Number(k[5]));
    return { prices, volumes };
  }catch(e){ return null; }
}

// Map common coin ids to Binance symbol (best-effort)
function coinIdToBinanceSymbol(id){
  const map = {
    bitcoin: 'BTCUSDT',
    ethereum: 'ETHUSDT',
    tether: null,
    binancecoin: 'BNBUSDT',
    ripple: 'XRPUSDT',
    solana: 'SOLUSDT',
    cardano: 'ADAUSDT',
    dogecoin: 'DOGEUSDT',
    polkadot: 'DOTUSDT',
    avalanche: 'AVAXUSDT',
    litecoin: 'LTCUSDT'
  };
  return map[id] || null;
}

// Run the local aggregator once and return parsed items (cached per invocation).
async function runAggregatorOnce(){
  const { execFileSync } = require('child_process');
  const outPath = path.join(process.cwd(), 'tmp', `trending-aggregator-last.json`);
  const script = path.join(process.cwd(), 'scripts', 'fetch-trending-aggregator.js');
      try{
      // Execute aggregator (stdout/stderr ignored) and write to outPath
      try{
      execFileSync(process.execPath, [script, `--sources=reddit,decrypt,nitter,coinmarketcap,forbes,coindesk`, `--hours=24`, `--out=${outPath}`], { stdio: ['ignore','ignore','pipe'], timeout: 90000 });
    }catch(execErr){
      try{ fs.writeFileSync(path.join(process.cwd(),'tmp', `trending-exec-err-${Date.now()}.log`), String(execErr && execErr.message || execErr), 'utf8'); }catch(e){}
    }

    if(!fs.existsSync(outPath)) return [];
    let raw = null;
    try{ raw = fs.readFileSync(outPath, 'utf8'); }catch(e){ return []; }
    let items = [];
    try{ items = JSON.parse(raw); }catch(e){
      try{ fs.writeFileSync(path.join(process.cwd(),'tmp', `trending-parse-err-${Date.now()}.log`), raw.slice(0,10000), 'utf8'); }catch(_){}
      return [];
    }
    if(!Array.isArray(items)) return [];
    return items;
  }catch(e){
    try{ fs.writeFileSync(path.join(process.cwd(),'tmp', `trending-err-${Date.now()}.log`), String(e && e.stack || e), 'utf8'); }catch(_){}
    return [];
  }
}

// Helper: find the best single match for a coin from an items array; returns single-item array or []
function findOneForCoinFromItems(items, id, name){
  if(!Array.isArray(items) || items.length===0) return [];
  const needleBase = String(name || id || '').toLowerCase();
  const aliasMap = {
    bitcoin: ['btc','bitcoin'],
    ethereum: ['eth','ethereum'],
    ripple: ['xrp','ripple'],
    solana: ['sol','solana'],
    cardano: ['ada','cardano'],
    dogecoin: ['doge','dogecoin'],
    polkadot: ['dot','polkadot'],
    avalanche: ['avax','avalanche'],
    litecoin: ['ltc','litecoin'],
    binancecoin: ['bnb','binance']
  };
  const needles = new Set();
  if(needleBase) needles.add(needleBase);
  const baseKey = String(id||'').toLowerCase();
  if(aliasMap[baseKey]) aliasMap[baseKey].forEach(a=>needles.add(a));
  String(name || '').split(/[\s\-\/]+/).map(s=>s.trim().toLowerCase()).filter(Boolean).forEach(s=>needles.add(s));

  for(const it of items){
    if(!it) continue;
    const t = (it.title || '').toLowerCase();
    const u = (it.url || '').toLowerCase();
    for(const n of needles){ if(n && (t.includes(n) || (u && u.includes(n)))){
      return [{ title: it.title, source: it.source || null, url: it.url, publishedAt: it.publishedAt || null, description: it.summary || it.description || null }];
    }}
  }

  // fallback: return the first global item if nothing matched
  const first = items[0];
  if(first) return [{ title: first.title, source: first.source || null, url: first.url, publishedAt: first.publishedAt || null, description: first.summary || first.description || null }];
  return [];
}

async function getReport(){
  console.log('crypto-weekly: getReport start');
  // disk cache to avoid rate limits
  const cachePath = path.join(__dirname, '..', 'tmp', 'crypto-weekly-cache.json');
  const ttl = parseInt(process.env.CRYPTO_WEEKLY_TTL_SECONDS || '300', 10);
  try{
    if(fs.existsSync(cachePath)){
      const stat = fs.statSync(cachePath);
      const age = (Date.now() - stat.mtimeMs) / 1000;
      if(age < ttl){
        const cached = JSON.parse(fs.readFileSync(cachePath,'utf8'));
        if(cached && cached.generatedAt && Array.isArray(cached.reports) && cached.reports.length) {
          console.log('crypto-weekly: using fresh cache');
          return cached;
        }
      }
    }
  }catch(e){ /* ignore cache errors */ }

  console.log('crypto-weekly: fetching top-10 coins');
  const coins = await fetchTop10Coins();
  console.log(`crypto-weekly: fetched ${Array.isArray(coins)?coins.length:0} coins`);
  if(!Array.isArray(coins) || coins.length===0) throw new Error('No coin data available');
  const reports = [];
  // Run aggregator once for the whole report to avoid per-request overhead
  console.log('crypto-weekly: running aggregator once for report');
  const aggItems = await runAggregatorOnce();
  console.log(`crypto-weekly: aggregator returned ${Array.isArray(aggItems)?aggItems.length:0} items`);

  for(const c of coins){
    try{
      console.log('crypto-weekly: processing coin', c && c.id);
      const id = c.id; const symbol = (c.symbol||'').toUpperCase(); const name = c.name;
      // prefer Binance klines when available for price+volume; otherwise use CoinGecko sparkline
      let prices = [];
      let volumes = [];
      const binSym = coinIdToBinanceSymbol(id);
      if(binSym){
        const b = await fetchBinance7dForSymbol(binSym);
        if(b && Array.isArray(b.prices) && b.prices.length) { prices = b.prices; volumes = b.volumes || []; }
      }
      if(!prices || !prices.length){
        // fallback to CoinGecko sparkline
        if(c && c.sparkline_in_7d && Array.isArray(c.sparkline_in_7d.price)) prices = c.sparkline_in_7d.price.slice();
        // volumes not available reliably from sparkline; approximate with zeros
        volumes = Array(prices.length).fill(0);
      }

      const priceSummary = buildPriceSummary(prices);
      const signals = detectSignals(prices, volumes || []);
      const narrative = buildNarrative(signals);

      const data = {
        snapshot: narrative,
        chronology: [],
        technicalReadout: [],
        levels: [],
        scenarios: [],
  checklist: [],
  events: []
      };

      const metrics = {
        currentPrice: c.current_price || (signals && signals.last) || null,
        marketCap: c.market_cap || null,
        circulatingSupply: c.circulating_supply || null
      };

      // futures: try Binance futures for major symbols
      let futures = null;
      if(binSym){
        try{
          const base = 'https://fapi.binance.com';
          const [premium, openInterest, ticker24] = await Promise.all([
            getJson(`${base}/fapi/v1/premiumIndex?symbol=${binSym}`),
            getJson(`${base}/fapi/v1/openInterest?symbol=${binSym}`),
            getJson(`${base}/fapi/v1/ticker/24hr?symbol=${binSym}`)
          ]).catch(()=>[null,null,null]);
          futures = { premium, openInterest, ticker24 };
        }catch(e){ futures = null; }
      }

      // attach a single recent news event (best-effort) using aggregated items
      try{
        data.events = findOneForCoinFromItems(aggItems, id, name);
        console.log(`crypto-weekly: news items for ${id}: ${Array.isArray(data.events)?data.events.length:0}`);
      }catch(e){ data.events = []; }

  reports.push({ id, symbol, name, priceSummary, signals, futures, data, prices, volumes, metrics, hero: '/assets/thisweekincrypto.webp' });
    }catch(e){ console.warn('crypto-weekly: per-coin analysis error', e && e.message); }
  }

  // Build a concise summary across the top-10 (exclude stablecoins)
  try{
    const stableIds = new Set(['tether','usd-coin','usdt','usdcoin','usdc','usd_coin']);
    const nonStable = reports.filter(r => r && r.id && !stableIds.has(String(r.id).toLowerCase()));
    const withChange = nonStable.filter(r => r && r.signals && typeof r.signals.change === 'number');
    const upSorted = withChange.slice().sort((a,b)=>b.signals.change - a.signals.change);
    const downSorted = withChange.slice().sort((a,b)=>a.signals.change - b.signals.change);
    const topUp = upSorted.slice(0,3).map(r => ({ id: r.id, name: r.name, symbol: r.symbol, change: Number(r.signals.change) }));
    const topDown = downSorted.slice(0,3).map(r => ({ id: r.id, name: r.name, symbol: r.symbol, change: Number(r.signals.change) }));
    const upCount = nonStable.filter(r => r && r.signals && r.signals.change > 0).length;
    const downCount = nonStable.filter(r => r && r.signals && r.signals.change < 0).length;
    const volSpikes = nonStable.filter(r => r && r.signals && r.signals.volumeSpike).map(r => r.name + ` (${r.symbol})`);
    const lowerHighs = nonStable.filter(r => r && r.signals && r.signals.lowerHighs).map(r => r.name + ` (${r.symbol})`);
    const sweepers = nonStable.filter(r => r && r.signals && r.signals.sweep).map(r => r.name + ` (${r.symbol})`);
    const rsiVals = nonStable.map(r => r && r.signals && Number(r.signals.rsi)).filter(v => !Number.isNaN(v) && v !== null);
    const avgRsi = rsiVals.length ? rsiVals.reduce((a,b)=>a+b,0)/rsiVals.length : null;
    const byMarketCap = nonStable.slice().filter(r=>r && r.metrics && r.metrics.marketCap).sort((a,b)=> (b.metrics.marketCap||0) - (a.metrics.marketCap||0));
    const marketLeader = byMarketCap.length ? byMarketCap[0].name + ` (${byMarketCap[0].symbol})` : null;

  // Create a concise two-line snapshot for the Snapshot card.
  // Line 1: short top gainers / losers (symbols + rounded %)
  // Line 2: market breadth, notable vol spikes (names), market leader
  const topUpShort = topUp.slice(0,3).map(t => `${t.symbol} ${Math.round(t.change)}%`).join(', ');
  const topDownShort = topDown.slice(0,3).map(t => `${t.symbol} ${Math.round(t.change)}%`).join(', ');
  const line1Parts = [];
  if(topUpShort) line1Parts.push(`Gainers: ${topUpShort}`);
  if(topDownShort) line1Parts.push(`Losers: ${topDownShort}`);
  const line1 = line1Parts.join(' • ') || `Top-10 snapshot: ${nonStable.length} assets`;

  const line2Parts = [`Breadth ${upCount}/${downCount}`];
  if(volSpikes.length) line2Parts.push(`Vol spikes: ${volSpikes.slice(0,3).join(', ')}`);
  // Intentionally omit marketLeader here to avoid duplicating the main subject (e.g. Bitcoin) in the snapshot
  const line2 = line2Parts.join(' • ');

  const summaryText = `${line1}\n${line2}`;

    return { generatedAt: new Date().toISOString(), reports, summary: summaryText, movers: { up: topUp, down: topDown } };
  }catch(e){
    return { generatedAt: new Date().toISOString(), reports };
  }
}

module.exports = { getReport };

// write cache on successful generation (fire-and-forget)
async function writeCache(obj){
  try{
    const cachePath = path.join(__dirname, '..', 'tmp', 'crypto-weekly-cache.json');
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(obj), 'utf8');
  }catch(e){ /* ignore */ }
}

// monkey-patch getReport to write cache on success
const originalGetReport = module.exports.getReport;
module.exports.getReport = async function(){
  const out = await originalGetReport();
  try{ writeCache(out); }catch(e){}
  return out;
};

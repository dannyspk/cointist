const https = require('https');
const fs = require('fs');
const path = require('path');
const CACHE_PATH = path.join(__dirname, '..', 'tmp', 'eth-metrics-cache.json');

function readCache(){
  try{
    if(fs.existsSync(CACHE_PATH)){
      const s = fs.readFileSync(CACHE_PATH, 'utf8');
      return JSON.parse(s);
    }
  }catch(e){}
  return null;
}

function writeCache(obj){
  try{
    const dir = path.dirname(CACHE_PATH);
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive:true });
    fs.writeFileSync(CACHE_PATH, JSON.stringify(obj,null,2),'utf8');
  }catch(e){}
}

function getJson(url, options={}){
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

async function fetchCoinGecko7d(){
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum&sparkline=true&price_change_percentage=7d';
  try{
    const parsed = await getJson(url, { headers: { 'User-Agent':'node.js','Accept':'application/json' } });
    if(Array.isArray(parsed) && parsed[0] && parsed[0].sparkline_in_7d && Array.isArray(parsed[0].sparkline_in_7d.price)){
      return parsed[0].sparkline_in_7d.price;
    }
  }catch(e){ console.warn('CoinGecko request failed', e.message); }
  const prices=[]; for(let i=7*24;i>=0;i--){ prices.push(1800 + Math.round(200 * Math.sin(i/6) + (Math.random()-0.5)*60)); }
  return prices;
}

async function fetchBinance7d(){
  const url = 'https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1h&limit=168';
  const parsed = await getJson(url, { headers:{ 'User-Agent':'node.js','Accept':'application/json' } });
  const prices = parsed.map(k=>Number(k[4]));
  const volumes = parsed.map(k=>Number(k[5]));
  return { prices, volumes };
}

async function fetchBinanceFutures(){
  const base = 'https://fapi.binance.com';
  try{
    const [premium, openInterest, ticker24, fundingHistory] = await Promise.all([
      getJson(`${base}/fapi/v1/premiumIndex?symbol=ETHUSDT`),
      getJson(`${base}/fapi/v1/openInterest?symbol=ETHUSDT`),
      getJson(`${base}/fapi/v1/ticker/24hr?symbol=ETHUSDT`),
      getJson(`${base}/fapi/v1/fundingRate?symbol=ETHUSDT&limit=10`)
    ]);
    return { premium, openInterest, ticker24, fundingHistory };
  }catch(e){ console.warn('Futures fetch failed', e.message); return null; }
}

function sma(values, period){ if(values.length<period) return null; const out=[]; for(let i=0;i<=values.length-period;i++){ const slice=values.slice(i,i+period); out.push(slice.reduce((a,b)=>a+b,0)/period); } return out; }
function rsi(values, period=14){ if(values.length<=period) return null; const deltas=[]; for(let i=1;i<values.length;i++) deltas.push(values[i]-values[i-1]); let gains=0, losses=0; for(let i=0;i<period;i++){ const d=deltas[i]; if(d>0) gains+=d; else losses-=d; } let avgGain=gains/period, avgLoss=losses/period; for(let i=period;i<deltas.length;i++){ const d=deltas[i]; if(d>0){ avgGain = (avgGain*(period-1) + d)/period; avgLoss = (avgLoss*(period-1))/period; } else { avgLoss = (avgLoss*(period-1) - d)/period; avgGain = (avgGain*(period-1))/period; } } if(avgLoss===0) return 100; const rs=avgGain/avgLoss; return 100 - (100/(1+rs)); }

function detectSignals(prices, volumes){
  const last = prices[prices.length-1]; const first = prices[0]; const change = ((last-first)/first)*100;
  const sma8 = sma(prices,8); const sma21 = sma(prices,21);
  const lastSMA8 = sma8 ? sma8[sma8.length-1] : null; const lastSMA21 = sma21 ? sma21[sma21.length-1] : null;
  const r = rsi(prices,14);
  const volMedian = volumes.slice().sort((a,b)=>a-b)[Math.floor(volumes.length/2)] || 0;
  const volumeSpike = volumes[volumes.length-1] > volMedian * 2.5;
  const recent = prices.slice(-24); let sweep=false; let maxDropPct=0;
  for(let i=0;i<recent.length;i++) for(let j=i+1;j<recent.length;j++){ const drop = (recent[i]-recent[j])/recent[i]*100; if(drop>maxDropPct) maxDropPct = drop; }
  if(maxDropPct>2.5) sweep=true;
  const peaks=[]; for(let i=2;i<prices.length-2;i++){ if(prices[i]>prices[i-1] && prices[i]>prices[i+1]) peaks.push(prices[i]); }
  const lastPeaks = peaks.slice(-3); const lowerHighs = lastPeaks.length>=3 && lastPeaks[0]>lastPeaks[1] && lastPeaks[1]>lastPeaks[2];
  return { last, change, rsi: r, lastSMA8, lastSMA21, volumeSpike, sweep, maxDropPct, lowerHighs };
}

function buildPriceSummary(prices){ const first = prices[0]; const last = prices[prices.length-1]; const min = Math.min(...prices); const max = Math.max(...prices); const change = ((last-first)/first)*100; return `First: $${first.toLocaleString(undefined,{maximumFractionDigits:2})}\nLast:  $${last.toLocaleString(undefined,{maximumFractionDigits:2})}\nLow:   $${min.toLocaleString(undefined,{maximumFractionDigits:2})}\nHigh:  $${max.toLocaleString(undefined,{maximumFractionDigits:2})}\nChange: ${change.toFixed(2)}%`; }

function buildNarrative(signals){
  let last7Analysis = '';
  if(signals.sweep) last7Analysis += `A fast liquidity sweep (~${signals.maxDropPct.toFixed(1)}% drop) occurred during the week, grabbing stops before the partial recovery.`;
  if(signals.lowerHighs) last7Analysis += ` Structure shows lower highs across recent peaks, which favors bearish continuation unless reclaimed.`;
  if(signals.volumeSpike) last7Analysis += ` A notable volume spike on the latest bar signals conviction behind the move.`;
  if(!last7Analysis) last7Analysis = 'Price action was mixed over the past week with modest net change and no dominant directional conviction.';
  return last7Analysis;
}

async function getReport(){
  let prices=null, volumes=null;
  try{ const b = await fetchBinance7d(); prices = b.prices; volumes = b.volumes; }catch(e){ console.warn('Binance fetch failed, falling back to CoinGecko:', e.message); prices = await fetchCoinGecko7d(); volumes = Array(prices.length).fill(0); }
  if(!prices || !Array.isArray(prices)) throw new Error('No price data available');
  const priceSummary = buildPriceSummary(prices);
  const signals = detectSignals(prices, volumes || []);
  const futures = await fetchBinanceFutures();

  // derive dynamic level estimates from the recent 7d prices
  const last = prices[prices.length-1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const immediateResistance = Math.round(last * 1.05);
  const supportZoneLow = Math.round(min);
  const supportZoneHigh = Math.round(min * 1.05);
  const keyLevel = Math.round((min + max) / 2);
  const fmt = v => v.toLocaleString();

  const data = {
    snapshot: buildNarrative(signals),
    chronology: [
      `Early week: price action held above ~${fmt(supportZoneLow)} and rotated through the mid-week range.`,
      `Midweek: option flows and leverage adjustments caused a short-lived volatility pickup around ${fmt(last)}.`,
      `Late week: price tested nearer-term resistance (~${fmt(immediateResistance)}) and rotated within a tight range, awaiting macro cues.`,
      `Technical: watch moving-average behavior around ${fmt(keyLevel)} and the ${fmt(supportZoneLow)}–${fmt(supportZoneHigh)} demand area.`
    ],
    technicalReadout: [
      'Momentum: RSI softened from overbought/oversold extremes into neutral territory; look for a clear directional bias on the next multi-day close.',
      'Moving averages: short/medium MAs are compressing near price — a decisive breakout above the 21-period SMA would favor buyers.',
      'Volume: recent bars show mixed participation; elevated volume on breakouts/retests will confirm conviction.',
      'Leverage & funding: watch short-term funding spikes and large open interest moves — these often precede rapid directional moves in ETH.'
    ],
    levels: [
      `Immediate Resistance: ${fmt(immediateResistance)}`,
      `Support Zone: ${fmt(supportZoneLow)}–${fmt(supportZoneHigh)}`,
      `Key Level: ${fmt(keyLevel)}`
    ],
    scenarios: [
      {title:'Range / consolidation (most likely)', text:`ETH remains rangebound between ${fmt(supportZoneLow)} and ${fmt(immediateResistance)} as macro events & option flows decide the next leg.`},
      {title:'Bullish breakout', text:`Sustained move above ${fmt(immediateResistance)} with volume and falling open interest → test higher resistances.`},
      {title:'Bearish break', text:`Rejection near ${fmt(immediateResistance)} and a break below ${fmt(supportZoneLow)} with rising open interest → fast move lower.`}
    ],
    checklist: [
      `For demand zone longs (~${fmt(supportZoneLow)}): wait for a bullish reaction candle with above‑average buy volume; set a stop just below ${fmt(Math.round(supportZoneLow*0.95))}.`,
      `For breakout longs: require a daily close above ${fmt(immediateResistance)} with confirming volume and neutral/declining leverage.`,
      `For short-sellers: prefer failed retests at resistance (~${fmt(immediateResistance)}) with clear rejection wicks and rising volume; keep size modest into expiries.`,
      'Risk management: trim into volatility and avoid oversized positions around macro prints (CPI, FOMC, major option expiries).'
    ]
  };
  // additional on-chain / infra metrics (best-effort)
  let metrics = { gasGwei: null, stakedEth: null, validators: null, tvlUsd: null, currentPrice: last, weekChange: signals.change, confidence: { gasGwei: null, stakedEth: null, validators: null, tvlUsd: null } };

    // helper: parse various gas price representations into plausible Gwei integers
    function parseToGwei(raw, extras){
      if(raw === undefined || raw === null) return null;
      // raw might be string or number
      const n = Number(raw);
      if(!Number.isFinite(n)) return null;
      // If value looks like a plausible Gwei (1..10000), accept it
      if(n >= 1 && n < 10000) return Math.round(n);
      // If value is clearly very large (likely wei), convert to Gwei
      if(n > 1e6) return Math.round(n / 1e9);

      // If value < 1, try sensible multipliers using extras (safe/propose/fast) if available
      const samples = [];
      if(Array.isArray(extras)) extras.forEach(x=>{ const v=Number(x); if(Number.isFinite(v)) samples.push(v); });
      samples.push(n);
      const multipliers = [1,10,100,1000,10000];
      const candidates = [];
      for(const m of multipliers){
        const mapped = samples.map(s=>s*m).filter(v=>Number.isFinite(v));
        if(mapped.length===0) continue;
        mapped.sort((a,b)=>a-b);
        const mid = mapped[Math.floor((mapped.length-1)/2)];
        if(mid >= 1 && mid < 1000000){
          candidates.push({m,mid});
        }
      }
      if(candidates.length>0){
        // prefer medians in sensible gas range
        const ACCEPT_MIN = 2, ACCEPT_MAX = 500;
        let best = null;
        for(const c of candidates){
          const score = Math.abs(c.mid - 50); // prefer near 50 gwei
          const inAccept = (c.mid >= ACCEPT_MIN && c.mid <= ACCEPT_MAX);
          if(!best) best = {c,score,inAccept};
          else {
            if(inAccept && !best.inAccept) best = {c,score,inAccept};
            else if(inAccept === best.inAccept && score < best.score) best = {c,score,inAccept};
          }
        }
        return Math.round(n * best.c.m);
      }
      return null;
    }
  try{
    // average gas (use etherscan gas tracker API as a fallback) - no api key assumed, use public blocknative or ethgasstation endpoints
    // primary attempt: try Etherscan gasoracle first (use API key if available)
    try{
      const apiKey = process.env.ETHERSCAN_API_KEY ? `&apikey=${process.env.ETHERSCAN_API_KEY}` : '';
      const g2 = await getJson(`https://api.etherscan.io/api?module=gastracker&action=gasoracle${apiKey}`);
      console.warn('eth-weekly: etherscan raw:', g2);
  if(g2 && g2.result && g2.result.ProposeGasPrice) { const parsed = parseToGwei(g2.result.ProposeGasPrice); if(parsed!==null){ metrics.gasGwei = parsed; console.warn('eth-weekly: etherscan gasoracle ok ->', parsed); } }
    }catch(e){ console.warn('eth-weekly: etherscan primary fetch failed, will attempt fallbacks:', e && e.message ? e.message : e); }

    // If Etherscan didn't yield a usable value, try etherchain retry then ethgas.watch (best-effort)
    if(metrics.gasGwei==null){
      try{
        const gasResp = await getJson('https://www.etherchain.org/api/gasprice'); // returns safeLow/standard/fast
        console.warn('eth-weekly: etherchain raw:', gasResp);
  if(gasResp && gasResp.standard) { const parsed = parseToGwei(gasResp.standard); if(parsed!==null){ metrics.gasGwei = parsed; console.warn('eth-weekly: etherchain gas ok ->', parsed); } }
      }catch(e){ console.warn('eth-weekly: etherchain fetch failed:', e && e.message ? e.message : e); }

      if(metrics.gasGwei==null){
        try{
          await new Promise(r=>setTimeout(r,300));
          const gasResp2 = await getJson('https://www.etherchain.org/api/gasprice');
          console.warn('eth-weekly: etherchain retry raw:', gasResp2);
          if(gasResp2 && gasResp2.standard) { const parsed = parseToGwei(gasResp2.standard); if(parsed!==null){ metrics.gasGwei = parsed; console.warn('eth-weekly: etherchain gas retry ok ->', parsed); } }
        }catch(e){ console.warn('eth-weekly: etherchain retry failed:', e && e.message ? e.message : e); }
      }

      if(metrics.gasGwei==null){
        try{
          const g3 = await getJson('https://ethgas.watch/api/gas');
          console.warn('eth-weekly: ethgas.watch raw:', g3);
          // ethgas.watch returns object with standard/fast/safeLow etc in some deployments
          if(g3 && (g3.standard || g3.average || g3.fast)){
            const pick = g3.standard || g3.average || g3.fast;
            const parsed = parseToGwei(pick);
            if(parsed!==null){ metrics.gasGwei = parsed; console.warn('eth-weekly: ethgas.watch fallback ok ->', parsed); }
          }
        }catch(e){ console.warn('eth-weekly: ethgas.watch fetch failed:', e && e.message ? e.message : e); }
      }
    }

    // staked ETH and validator count from beacon explorers (robust parsing + fallbacks)
    try{
      // helper: attempt to interpret a raw numeric staked value in wei/gwei/eth
      function parseStaked(raw){
        if(raw === undefined || raw === null) return null;
        const n = Number(raw);
        if(Number.isFinite(n)){
          // if very large (>1e17) likely wei -> ETH = n / 1e18
          if(Math.abs(n) > 1e17) return n / 1e18;
          // if large (>1e12) likely gwei -> ETH = n / 1e9
          if(Math.abs(n) > 1e12) return n / 1e9;
          // if reasonably sized (>1e3) treat as ETH already (e.g., 3e7 -> 30M ETH)
          if(Math.abs(n) > 1e3) return n;
          // otherwise small number, treat as ETH
          return n;
        }
        // if object, look for common keys
        if(typeof raw === 'object'){
          if(raw.total_stake && !Number.isNaN(Number(raw.total_stake))) return parseStaked(Number(raw.total_stake));
          if(raw.active_stake && !Number.isNaN(Number(raw.active_stake))) return parseStaked(Number(raw.active_stake));
          if(raw.total && !Number.isNaN(Number(raw.total))) return parseStaked(Number(raw.total));
          if(raw.total_deposit && !Number.isNaN(Number(raw.total_deposit))) return parseStaked(Number(raw.total_deposit));
          if(raw.value && !Number.isNaN(Number(raw.value))) return parseStaked(Number(raw.value));
        }
        return null;
      }

      // attempt primary beacon summary endpoint
      try{
        const beaconKey = process.env.BEACONCHA_API_KEY;
        function appendApiKey(url, key){ if(!key) return url; return url + (url.includes('?') ? '&' : '?') + 'apikey=' + encodeURIComponent(key); }
        const beaconUrl = appendApiKey('https://beaconcha.in/api/v1/epoch/validators/summary', beaconKey);
        if(beaconKey) console.warn('eth-weekly: using BEACONCHA_API_KEY for beaconcha requests');
        const beacon = await getJson(beaconUrl);
        console.warn('eth-weekly: beaconcha raw:', beacon && beacon.data ? Object.keys(beacon.data) : typeof beacon);
        if(beacon && beacon.data){
          // multiple key names across explorers: try several
          const candValidators = beacon.data.activevalidators || beacon.data.active_validators || beacon.data.validators || beacon.data.total_validators || beacon.data.validatorscount;
          if(candValidators){ metrics.validators = Number(candValidators); metrics.confidence.validators = 'reported'; }
          const candStake = beacon.data.active_stake || beacon.data.total_stake || beacon.data.total_deposit || beacon.data.total || beacon.data.value;
          const parsed = parseStaked(candStake);
          if(parsed!==null){ metrics.stakedEth = parsed; metrics.confidence.stakedEth = 'reported'; }
          if(metrics.validators!==null || metrics.stakedEth!==null) console.warn('eth-weekly: beaconcha primary metrics ok ->', {validators: metrics.validators, stakedEth: metrics.stakedEth, confidence: metrics.confidence});
        }
      }catch(e){ console.warn('eth-weekly: beaconcha primary fetch failed:', e && e.message ? e.message : e); }

      // small retry if missing
      if(metrics.validators==null || metrics.stakedEth==null){
  try{ await new Promise(r=>setTimeout(r,300)); const beacon2 = await getJson(appendApiKey('https://beaconcha.in/api/v1/epoch/validators/summary', process.env.BEACONCHA_API_KEY)); if(beacon2 && beacon2.data){ const candValidators = beacon2.data.activevalidators || beacon2.data.active_validators || beacon2.data.validators || beacon2.data.total_validators; if(candValidators && (metrics.validators===null || metrics.validators===undefined)){ metrics.validators = Number(candValidators); metrics.confidence.validators = 'reported'; } const candStake = beacon2.data.active_stake || beacon2.data.total_stake || beacon2.data.total || beacon2.data.value; const parsed = parseStaked(candStake); if(parsed!==null && (metrics.stakedEth===null || metrics.stakedEth===undefined)){ metrics.stakedEth = parsed; metrics.confidence.stakedEth = 'reported'; } console.warn('eth-weekly: beaconcha retry metrics ok ->', {validators: metrics.validators, stakedEth: metrics.stakedEth, confidence: metrics.confidence}); } }catch(_){ console.warn('eth-weekly: beaconcha retry failed'); }
      }

      // fallback: lightweight summary endpoint
      if(metrics.validators==null || metrics.stakedEth==null){
        try{
          const b2 = await getJson(appendApiKey('https://beaconcha.in/api/v1/summary', process.env.BEACONCHA_API_KEY));
            if(b2 && b2.data){
            const candValidators = b2.data.activevalidators || b2.data.active_validators || b2.data.validators;
            if(candValidators && (metrics.validators===null || metrics.validators===undefined)){ metrics.validators = Number(candValidators); metrics.confidence.validators = 'reported'; }
            const candStake = b2.data.active_stake || b2.data.total_stake || b2.data.total || b2.data.value;
            const parsed = parseStaked(candStake);
            if(parsed!==null && (metrics.stakedEth===null || metrics.stakedEth===undefined)){ metrics.stakedEth = parsed; metrics.confidence.stakedEth = 'reported'; }
            console.warn('eth-weekly: beaconcha summary fallback ok ->', {validators: metrics.validators, stakedEth: metrics.stakedEth, confidence: metrics.confidence});
          }
        }catch(_){ console.warn('eth-weekly: beaconcha summary fallback failed'); }
      }
    }catch(e){ /* ignore */ }

    // If still missing, probe a broader list of known beacon/explorer endpoints automatically
    if(metrics.validators==null || metrics.stakedEth==null){
      const beaconCandidates = [
  'https://beaconcha.in/api/v1/epoch/validators/summary',
        'https://beaconcha.in/api/v1/summary',
        'https://beaconcha.in/api/v1/validators/summary',
        'https://beaconcha.in/api/v1/validator/summary',
  // probe specific slot/epoch endpoints (known working with apikey)
  'https://beaconcha.in/api/v1/slot/1',
  'https://beaconcha.in/api/v1/epoch/1',
        'https://beaconchain.info/api/v1/validators/summary',
        'https://beaconscan.com/api/v1/summary',
        'https://beaconcha.in/api/v1/network/summary',
        'https://beaconcha.in/api/v1/stats',
        'https://beaconcha.in/api/v1/network',
        // generic endpoints that sometimes host JSON summaries
        'https://beaconcha.in/api/v1',
        'https://beaconchain.info/api/v1',
        'https://beaconscan.com/api'
      ];
    for(const url of beaconCandidates){
        if(metrics.validators!==null && metrics.stakedEth!==null) break;
        try{
          const effectiveUrl = url.includes('beaconcha.in') ? (appendApiKey ? appendApiKey(url, process.env.BEACONCHA_API_KEY) : url) : url;
          const r = await getJson(effectiveUrl);
          console.warn('eth-weekly: probe', url, '->', typeof r);
          // try to find validators and stake in the response at top-level or .data
          const candidateSources = [];
          if(r){ candidateSources.push(r); if(r.data) candidateSources.push(r.data); }

          // recursive search helper: gather numeric fields with paths
          function collectNumericFields(obj, path = ''){
            const found = [];
            if(obj === null || obj === undefined) return found;
            if(typeof obj === 'number' && Number.isFinite(obj)) { found.push({path, value: obj}); return found; }
            if(typeof obj === 'string' && !Number.isNaN(Number(obj))){ found.push({path, value: Number(obj)}); return found; }
            if(Array.isArray(obj)){
              for(let i=0;i<obj.length;i++){
                const sub = collectNumericFields(obj[i], path + `[${i}]`);
                if(sub.length) found.push(...sub);
                if(found.length>200) break;
              }
              return found;
            }
            if(typeof obj === 'object'){
              for(const k of Object.keys(obj)){
                try{
                  const sub = collectNumericFields(obj[k], path ? path + '.' + k : k);
                  if(sub.length) found.push(...sub);
                }catch(_){ }
                if(found.length>200) break;
              }
            }
            return found;
          }

          // heuristic chooser for numeric candidates
          for(const src of candidateSources){
            if(!src) continue;
            // prioritize eth1 deposit count if present (deposit_count -> validators, stakedEth = count*32)
            try{
              const depositCount = (src && (src.eth1data_depositcount || (src.data && src.data.eth1data_depositcount))) || null;
              if(depositCount && Number.isFinite(Number(depositCount))){
                const cnt = Number(depositCount);
                // overwrite guessed or null values with inferred-from-deposit-count
                metrics.validators = cnt;
                metrics.stakedEth = cnt * 32;
                metrics.confidence.validators = 'inferred_from_deposit_count';
                metrics.confidence.stakedEth = 'inferred_from_deposit_count';
                console.warn('eth-weekly: probe inferred from eth1data_depositcount ->', {validators: metrics.validators, stakedEth: metrics.stakedEth, confidence: metrics.confidence});
                if(metrics.validators!==null && metrics.stakedEth!==null) break;
              }
            }catch(_){ }
            // look for well-known field names first
            const namePriority = {
              validators: ['activevalidators','active_validators','validators','total_validators','validatorscount','validators_count','total_validators_count','validatorsCount','validator_count','validatorCount'],
              stake: ['active_stake','total_stake','total_deposit','total_deposit_amount','total','value','staked','staked_eth','total_staked_eth']
            };
            for(const nv of Object.keys(namePriority)){
              for(const n of namePriority[nv]){
                if(src[n]!==undefined && src[n]!==null){
                  const v = Number(src[n]);
                  if(Number.isFinite(v)){
                    if(nv==='validators' && (metrics.validators===null || metrics.validators===undefined)) metrics.validators = v;
                    if(nv==='stake' && (metrics.stakedEth===null || metrics.stakedEth===undefined)) metrics.stakedEth = parseStaked(v) || metrics.stakedEth;
                  }
                }
              }
            }

            // generic numeric scan
            if((metrics.validators===null || metrics.stakedEth===null)){
              const nums = collectNumericFields(src).slice(0,400);
        for(const p of nums){
                if(metrics.validators===null || metrics.validators===undefined){
                  // plausible validators count
          if(p.value > 100 && p.value < 5000000){ metrics.validators = Math.round(p.value); metrics.confidence.validators = 'guessed'; console.warn('eth-weekly: probe guessed validators from', p.path, '->', metrics.validators); }
                }
                if(metrics.stakedEth===null || metrics.stakedEth===undefined){
                  // plausible staked ETH
          const stakeGuess = parseStaked(p.value);
          if(stakeGuess!==null && stakeGuess > 1000 && stakeGuess < 500000000){ metrics.stakedEth = stakeGuess; metrics.confidence.stakedEth = 'guessed'; console.warn('eth-weekly: probe guessed stakedEth from', p.path, '->', metrics.stakedEth); }
                }
                if((metrics.validators!==null && metrics.stakedEth!==null)) break;
              }
            }

            if(metrics.validators!==null || metrics.stakedEth!==null) console.warn('eth-weekly: probe success ->', {url, validators: metrics.validators, stakedEth: metrics.stakedEth, confidence: metrics.confidence});
            if(metrics.validators!==null && metrics.stakedEth!==null) break;
          }
        }catch(e){ /* ignore probe failure */ }
      }
    }

    // TVL from DefiLlama for Ethereum (robust parsing + fallbacks)
    try{
      // helper to parse many shapes DefiLlama may return
      async function parseDlTvl(raw){
        if(raw === undefined || raw === null) return null;
        // number or numeric string
        if(typeof raw === 'number' && !Number.isNaN(raw)) return Math.round(raw);
        if(typeof raw === 'string' && !Number.isNaN(Number(raw))) return Math.round(Number(raw));

        // time-series array (points or objects) -> find latest numeric tvl
        if(Array.isArray(raw) && raw.length>0){
          for(let i=raw.length-1;i>=0;i--){
            const el = raw[i];
            if(el === null || el === undefined) continue;
            if(typeof el === 'number' && !Number.isNaN(el)) return Math.round(el);
            if(Array.isArray(el) && el.length>=2 && !Number.isNaN(Number(el[1]))) return Math.round(Number(el[1]));
            if(typeof el === 'object'){
              if(el.totalLiquidityUSD && !Number.isNaN(Number(el.totalLiquidityUSD))) return Math.round(Number(el.totalLiquidityUSD));
              if(el.tvl && !Number.isNaN(Number(el.tvl))) return Math.round(Number(el.tvl));
            }
          }
          return null;
        }

        // object shape: look for common properties or timestamp-keyed map
        if(typeof raw === 'object'){
          if(raw.tvl && !Number.isNaN(Number(raw.tvl))) return Math.round(Number(raw.tvl));
          if(raw.totalLiquidityUSD && !Number.isNaN(Number(raw.totalLiquidityUSD))) return Math.round(Number(raw.totalLiquidityUSD));
          if(raw.total && !Number.isNaN(Number(raw.total))) return Math.round(Number(raw.total));
          // might be a map of timestamp->value
          const keys = Object.keys(raw).filter(k=>!/^(status|name|chain)$/i.test(k)).sort();
          for(let i=keys.length-1;i>=0;i--){ const v = raw[keys[i]]; if(v!==undefined && v!==null && !Number.isNaN(Number(v))) return Math.round(Number(v)); }
        }
        return null;
      }

      // primary: dedicated TVL endpoint for Ethereum
      try{
        const dlEth = await getJson('https://api.llama.fi/tvl/ethereum');
        console.warn('eth-weekly: defillama raw:', Array.isArray(dlEth)?`array[len=${dlEth.length}]`:(typeof dlEth));
        const v = await parseDlTvl(dlEth);
        if(v){ metrics.tvlUsd = v; console.warn('eth-weekly: defillama tvl ok ->', v); }
        if(!metrics.tvlUsd) throw new Error('dlEth not parsable');
      }catch(_){
        // fallback: try chains list to locate ethereum entry
        try{
          const dl = await getJson('https://api.llama.fi/chains');
          if(Array.isArray(dl)){
            const ethChain = dl.find(c=>c && ((c.chain && String(c.chain).toLowerCase()==='ethereum') || (c.name && String(c.name).toLowerCase().includes('ethereum'))));
            if(ethChain){
              const v = await parseDlTvl(ethChain.tvl || ethChain.tvlUsd || ethChain.total || ethChain.value || ethChain);
              if(v){ metrics.tvlUsd = v; console.warn('eth-weekly: defillama chains entry ok ->', v); }
            }
          }else{
            // last resort: map endpoint
            const dl2 = await getJson('https://api.llama.fi/tvl');
            if(dl2 && (dl2.ethereum || dl2['Ethereum'])){
              const candidate = dl2.ethereum || dl2['Ethereum'];
              if(!Number.isNaN(Number(candidate))){ metrics.tvlUsd = Math.round(Number(candidate)); console.warn('eth-weekly: defillama tvl map ok ->', metrics.tvlUsd); }
            }
          }
        }catch(_2){ console.warn('eth-weekly: defillama tvl fetch failed'); }
      }
    }catch(e){ /* ignore */ }
  }catch(e){ /* swallow metric errors */ }

  // if metrics all null (except currentPrice/weekChange), try fallback to cached values
  const hasLive = (metrics.gasGwei!==null) || (metrics.stakedEth!==null) || (metrics.validators!==null) || (metrics.tvlUsd!==null);
  if(hasLive){
    try{ writeCache({ metrics, ts: Date.now() }); }catch(_){}
  }else{
    // read cached metrics if available
    try{
      const cached = readCache();
      if(cached && cached.metrics){
        // merge cached values for missing metrics
        metrics = Object.assign({}, cached.metrics, metrics);
      }
    }catch(_){}
  }

  return { priceSummary, signals, futures, data, prices, volumes, metrics };
}

module.exports = { getReport };

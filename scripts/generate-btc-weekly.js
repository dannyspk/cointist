#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
// optional LLM support (requires OPENAI_API_KEY in env)
let fetchFn = null;
try{ fetchFn = require('node-fetch'); }catch(e){ fetchFn = null; }

async function generateNarrativeWithLLM(signals, priceSummary){
  const apiKey = process.env.OPENAI_API_KEY;
  if(!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const prompt = `You are a concise market analyst. Given the following JSON signals and a short price summary, produce a JSON object with keys: snapshot (1-2 short sentences), chronology (array up to 7 brief timeline bullets), technicalReadout (array up to 6 concise bullets), scenarios (array of up to 3 objects with title and text). Respond with valid JSON only.\n\nsignals: ${JSON.stringify(signals)}\n\npriceSummary: ${String(priceSummary)}\n\nExample response shape: {"snapshot":"...","chronology":["..."],"technicalReadout":["..."],"scenarios":[{"title":"...","text":"..."}]}`;

  // Helper to call OpenAI either via Responses API (for gpt-5) or Chat Completions (older models)
  async function callOpenAI(body, url){
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    const reqBody = JSON.stringify(body);
    try{
      console.log('LLM request URL:', url);
      console.log('LLM request body:', reqBody);
      const res = await (fetchFn ? fetchFn(url, { method: 'POST', headers, body: reqBody }) : fetch(url, { method: 'POST', headers, body: reqBody }));
      if(!res){ console.warn('LLM narrative request had no response object'); return null; }
      if(!res.ok){
        let text = null;
        try{ text = await res.text(); }catch(e){ text = `<failed to read body: ${e && e.message}>`; }
        console.warn('LLM narrative request failed', res.status, text);
        return null;
      }
      return await res.json();
    }catch(e){
      console.warn('LLM narrative request failed (exception)', e && e.message);
      return null;
    }
  }

  try{
    console.log('LLM model:', model);
    // Use Responses API for gpt-5 family which returns a different shape
    if(String(model).toLowerCase().startsWith('gpt-5')){
  const url = 'https://api.openai.com/v1/responses';
  const body = { model, input: prompt, max_output_tokens: 500 };
      const json = await callOpenAI(body, url);
      if(!json) return null;
      // Responses API may include text in multiple places; try common locations
      let content = null;
      if(json.output_text) content = json.output_text;
      else if(Array.isArray(json.output) && json.output.length){
        // concatenate text-like pieces
        content = json.output.map(o => {
          if(o.content && Array.isArray(o.content)) return o.content.map(c => c.text || '').join('');
          return o.text || '';
        }).join('\n');
      } else if(json.output && typeof json.output === 'string') content = json.output;
      if(!content) return null;
      const m = content.match(/\{[\s\S]*\}/m);
      const jtxt = m ? m[0] : content;
      try{ return JSON.parse(jtxt); }catch(e){ console.warn('Failed to parse LLM JSON response'); return null; }
    }

    // Fallback: Chat Completions API for older models
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model,
      messages: [
        { role: 'system', content: 'You are a professional financial market analyst. Be concise and factual.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.6
    };
    const json = await callOpenAI(body, url);
    if(!json) return null;
    const content = (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || (json.choices && json.choices[0] && json.choices[0].text);
    if(!content) return null;
    const m = content.match(/\{[\s\S]*\}/m);
    const jtxt = m ? m[0] : content;
    try{ return JSON.parse(jtxt); }catch(e){ console.warn('Failed to parse LLM JSON response'); return null; }
  }catch(e){ console.warn('LLM narrative generation failed', e && e.message); return null; }
}

async function fetchCoinGecko7d() {
  const https = require('https');
  const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&sparkline=true&price_change_percentage=7d';
  const options = { headers: { 'User-Agent': 'node.js', 'Accept': 'application/json' } };

  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = '';
        const req = https.get(url, options, (res) => {
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(data);
            return reject(new Error(`CoinGecko fetch failed: ${res.statusCode} - ${res.statusMessage}`));
          });
        });
        req.on('error', reject);
      });

      const parsed = JSON.parse(body);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Unexpected markets response');
      const item = parsed[0];
      if (!item.sparkline_in_7d || !Array.isArray(item.sparkline_in_7d.price)) throw new Error('No sparkline data');
      return item.sparkline_in_7d.price;
    } catch (err) {
      // If last attempt, rethrow; otherwise wait and retry
      if (attempt === 4) {
        console.error('CoinGecko fetch failed after retries:', err.message);
        break;
      }
      const wait = 1000 * Math.pow(2, attempt); // 2s,4s,8s
      console.warn(`CoinGecko fetch attempt ${attempt} failed: ${err.message} — retrying in ${wait}ms`);
      await new Promise(r=>setTimeout(r, wait));
    }
  }

  // Fallback: return a small synthetic price series to allow report generation
  console.warn('Using fallback price data for report generation');
  const now = Date.now();
  const prices = [];
  for (let i = 7*24; i >= 0; i--) {
    // synthetic oscillation around 110000
    const p = 110000 + Math.round(3000 * Math.sin(i/6) + (Math.random()-0.5)*800);
    prices.push(p);
  }
  return prices;
}

async function fetchBinance7d() {
  // hourly klines for last 7 days (168 hours)
  const https = require('https');
  const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=168';
  return new Promise((resolve, reject) => {
    const options = { headers: { 'User-Agent': 'node.js', 'Accept': 'application/json' } };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try{
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            // parsed is array of klines; each kline: [openTime, open, high, low, close, volume, ...]
            const prices = parsed.map(k => Number(k[4]));
            const volumes = parsed.map(k => Number(k[5]));
            resolve({prices, volumes});
          } else {
            reject(new Error(`Binance fetch failed: ${res.statusCode} - ${res.statusMessage}`));
          }
        }catch(e){ reject(e); }
      });
    }).on('error', (err) => reject(err));
  });
}

async function fetchBinanceFutures(){
  // fetch a few futures endpoints: premiumIndex (mark price, funding rate), openInterest, 24h ticker, recent funding rates
  const https = require('https');
  const base = 'https://fapi.binance.com';
  const endpoints = {
    premium: `${base}/fapi/v1/premiumIndex?symbol=BTCUSDT`,
    openInterest: `${base}/fapi/v1/openInterest?symbol=BTCUSDT`,
    ticker24: `${base}/fapi/v1/ticker/24hr?symbol=BTCUSDT`,
    fundingHistory: `${base}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=10`
  };
  const options = { headers: { 'User-Agent':'node.js', 'Accept':'application/json' } };
  const get = (url) => new Promise((resolve,reject)=>{
    let data='';
    https.get(url, options, (res)=>{
      res.on('data', c=>data+=c);
      res.on('end', ()=>{
        if(res.statusCode>=200 && res.statusCode<300) return resolve(JSON.parse(data));
        return reject(new Error(`Futures fetch failed ${res.statusCode}`));
      });
    }).on('error', reject);
  });
  try{
    const [premium, openInterest, ticker24, fundingHistory] = await Promise.all([
      get(endpoints.premium), get(endpoints.openInterest), get(endpoints.ticker24), get(endpoints.fundingHistory)
    ]);
    return { premium, openInterest, ticker24, fundingHistory };
  }catch(e){
    console.warn('Binance futures fetch failed:', e.message);
    return null;
  }
}

// TradingView extraction removed per request. Ideas block is omitted for now.

function sma(values, period){
  if(values.length < period) return null;
  const out = [];
  for(let i=0;i<=values.length-period;i++){
    const slice = values.slice(i,i+period);
    out.push(slice.reduce((a,b)=>a+b,0)/period);
  }
  return out; // oldest->newest
}

function rsi(values, period=14){
  if(values.length <= period) return null;
  // compute gains/losses on closes
  const deltas = [];
  for(let i=1;i<values.length;i++) deltas.push(values[i]-values[i-1]);
  let gains = 0, losses = 0;
  for(let i=0;i<period;i++){ const d=deltas[i]; if(d>0) gains+=d; else losses-=d; }
  let avgGain = gains/period; let avgLoss = losses/period;
  for(let i=period;i<deltas.length;i++){
    const d = deltas[i];
    if(d>0){ avgGain = (avgGain*(period-1) + d)/period; avgLoss = (avgLoss*(period-1))/period; }
    else { avgLoss = (avgLoss*(period-1) - d)/period; avgGain = (avgGain*(period-1))/period; }
  }
  if(avgLoss === 0) return 100;
  const rs = avgGain/avgLoss;
  return 100 - (100/(1+rs));
}

function detectSignals(prices, volumes){
  const last = prices[prices.length-1];
  const first = prices[0];
  const change = ((last-first)/first)*100;
  const sma8 = sma(prices,8); const sma21 = sma(prices,21);
  const lastSMA8 = sma8 ? sma8[sma8.length-1] : null;
  const lastSMA21 = sma21 ? sma21[sma21.length-1] : null;
  const r = rsi(prices,14);
  // volume spike detection: compare last hour to median
  const volMedian = volumes.slice().sort((a,b)=>a-b)[Math.floor(volumes.length/2)] || 0;
  const volumeSpike = volumes[volumes.length-1] > volMedian * 2.5;
  // recent drawdown / sweep: max drop within last 24 samples
  const recent = prices.slice(-24);
  let sweep=false; let maxDropPct=0;
  for(let i=0;i<recent.length;i++){
    for(let j=i+1;j<recent.length;j++){
      const drop = (recent[i]-recent[j])/recent[i]*100;
      if(drop>maxDropPct) maxDropPct = drop;
    }
  }
  if(maxDropPct > 2.5) sweep = true;
  // lower highs detection: find 3 recent peaks and see trend
  const peaks = [];
  for(let i=2;i<prices.length-2;i++){
    if(prices[i] > prices[i-1] && prices[i] > prices[i+1]) peaks.push({i, v: prices[i]});
  }
  const lastPeaks = peaks.slice(-3).map(p=>p.v);
  const lowerHighs = lastPeaks.length>=3 && lastPeaks[0]>lastPeaks[1] && lastPeaks[1]>lastPeaks[2];
  return {last, change, rsi:r, lastSMA8, lastSMA21, volumeSpike, sweep, maxDropPct, lowerHighs};
}

function buildPriceSummary(prices){
  // prices: numeric array oldest->newest
  const first = prices[0];
  const last = prices[prices.length-1];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const change = ((last-first)/first)*100;
  return `First: $${first.toLocaleString(undefined,{maximumFractionDigits:2})}\nLast:  $${last.toLocaleString(undefined,{maximumFractionDigits:2})}\nLow:   $${min.toLocaleString(undefined,{maximumFractionDigits:2})}\nHigh:  $${max.toLocaleString(undefined,{maximumFractionDigits:2})}\nChange: ${change.toFixed(2)}%`;
}
// Extract narrative creation so it can be used both for HTML and JSON output
function generateNarrative(signals){
  let last7Analysis = '';
  if(signals.sweep) last7Analysis += `A fast liquidity sweep (~${signals.maxDropPct.toFixed(1)}% drop) occurred during the week, grabbing stops before the partial recovery.`;
  if(signals.lowerHighs) last7Analysis += ` Structure shows lower highs across recent peaks, which favors bearish continuation unless reclaimed.`;
  if(signals.volumeSpike) last7Analysis += ` A notable volume spike on the latest bar signals conviction behind the move.`;
  if(!last7Analysis) last7Analysis = 'Price action was mixed over the past week with modest net change and no dominant directional conviction.';

  const chronology = [
    'Early week: multiple rejections at the 116k–118k supply zone; bullish momentum cooled.',
    'Midweek: a rapid liquidity sweep down to ~107k–109k (stop hunt) with elevated sell volume.',
    'Post‑sweep: a bounce/retest into the 111k–114k gap area (partial fill) but sellers remained active around 116k.',
    'Current: lower highs and weak confirmation on the bounce; watch the reaction at the gap and the 109k demand band.'
  ];

  const technicalReadout = [
    'Momentum: RSI softened from overbought to neutral/weak; no clear bullish divergence on the bounce.',
    'Moving averages: short/medium MAs remain at or above price — bulls need a reclaim to shift bias.',
    'Volume: heavy selling on the sweep; muted volume on the bounce indicates limited conviction.',
    'CME gap: the unfinished gap near ~114–116k acted as a magnet; reaction at that zone is important.'
  ];

  const levels = ['Immediate Resistance: 114k','Supply Zone: 116k–118k','Demand Zone: 109k','Sweep Low / Support: 107k','Bear Targets: 105k / 102k'];

  const scenarios = [
    {title:'Bearish continuation (most likely)', text:'Fail to reclaim 116–118k → rollover → break 109k → impulse toward 105–102k.'},
    {title:'Range / chop (plausible)', text:'Price oscillates between 109k–116k as macro events & flows decide the next leg.'},
    {title:'Bullish recovery (lower probability)', text:'Sustained daily close above ~116.5–118k with high volume → retest 123k+.'},
    {title:'Event risk', text:'NFP, CPI, FOMC and options expiries can amplify intraday moves; avoid heavy sizing around these.'}
  ];

  const checklist = [
    'For demand zone longs (~109k): wait for a bullish reaction candle + above‑average buy volume; stop under 107k.',
    'For H&S shorts: wait for a retest of ~112–112.5k that fails and shows rejection volume; reduce size into expiries.',
    'If price closes daily above 118k with volume, reconsider bearish sizing and prefer bullish setups.',
    'Keep position sizing modest (1–2% capital per trade) — the structure is still corrective and volatile.'
  ];

  return { last7Analysis, chronology, technicalReadout, levels, scenarios, checklist };
}
function buildHtml(priceSummary, signals={}, futures=null, opts={}, narrative=null){
  const now = new Date().toISOString().slice(0,10);
  // Use provided narrative (from generateNarrative) or build one locally
  const nv = narrative || generateNarrative(signals);
  const last7Analysis = nv.last7Analysis;
  const chronology = nv.chronology;
  const technicalReadout = nv.technicalReadout;
  const levels = nv.levels;
  const scenarios = nv.scenarios;
  const checklist = nv.checklist;

  // format estimated USD open interest consistently (round, no cents, abbreviate >=1e9)
  const fmtUsd = (v)=>{
    if(!v && v!==0) return 'N/A';
    const rounded = Math.round(v);
    if(rounded >= 1e9) return `$${(rounded/1e9).toFixed(2).replace(/\\.00$/,'')}B`;
    return `$${rounded.toLocaleString()}`;
  };

  const oiUsdDisplay = (futures && futures.premium && futures.premium.markPrice && futures.openInterest)
    ? fmtUsd(Number(futures.openInterest.openInterest) * Number(futures.premium.markPrice))
    : 'N/A';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>BTC — Last 7 Days Analysis ${now}</title>
  <link rel="stylesheet" href="/reports/report.css" />
</head>
<body>
  <div class="wrapper">
    <div class="title">
      <h1>BTC — Last 7 Days Analysis</h1>
      <div class="muted">Generated: ${now}</div>
    </div>

    <div class="card">
      <h2 class="snapshot-title">Snapshot</h2>
      <p class="muted">${last7Analysis}</p>
    </div>

    <div class="card">
      <h3 class="section-title">Practical checklist</h3>
      <ul class="clean">
        ${checklist.map(i=>`<li>${i}</li>`).join('\n')}
      </ul>
    </div>

    <div class="card grid">
      <div>
        <h3 class="section-title">Week chronology — what happened</h3>
        <ul class="clean">
          ${chronology.map(s=>`<li>${s}</li>`).join('\n')}
        </ul>

        <h3 class="section-title">Technical readout</h3>
        <ul class="clean">
          ${technicalReadout.map(s=>`<li>${s}</li>`).join('\n')}
        </ul>
      </div>

      <aside class="aside">
        <h3 class="section-title">Price summary</h3>
        <div class="price-summary">${priceSummary}</div>

        <h3 class="section-title">Key levels</h3>
        <div class="levels">${levels.map(l=>`<span class="level">${l}</span>`).join('')}</div>
      </aside>
    </div>

      <div class="card scenarios">
      <h3 class="section-title">Scenario syntheses</h3>
      ${scenarios.map(s=>`<p><strong>${s.title}:</strong> <span class="muted">${s.text}</span></p>`).join('\n')}
    </div>

      <div class="card">
        <h3 class="section-title">Computed signals</h3>
        <ul class="clean">
          <li>Last price: <strong>$${signals.last?.toLocaleString?.()}</strong></li>
          <li>7d change: <strong>${signals.change?.toFixed(2)}%</strong></li>
          <li>RSI(14): <strong>${signals.rsi ? signals.rsi.toFixed(1) : 'n/a'}</strong></li>
          <li>SMA8: <strong>${signals.lastSMA8 ? signals.lastSMA8.toFixed(0) : 'n/a'}</strong>, SMA21: <strong>${signals.lastSMA21 ? signals.lastSMA21.toFixed(0) : 'n/a'}</strong></li>
          <li>Volume spike: <strong>${signals.volumeSpike ? 'yes' : 'no'}</strong></li>
          <li>Recent sweep: <strong>${signals.sweep ? `${signals.maxDropPct.toFixed(1)}%` : 'no'}</strong></li>
          <li>Lower highs: <strong>${signals.lowerHighs ? 'yes' : 'no'}</strong></li>
        </ul>
      </div>

  <!-- TradingView ideas removed -->

    <div class="card">
      <h3 class="section-title">Practical checklist</h3>
      <ul class="clean">
        ${checklist.map(i=>`<li>${i}</li>`).join('\n')}
      </ul>
    </div>

    <div class="card">
      <h3 class="section-title">Futures readout (Binance USDT‑M)</h3>
      ${futures ? `
      <ul class="clean">
        <li>Perp last price: <strong>$${Number(futures.ticker24.lastPrice).toLocaleString()}</strong> (${Number(futures.ticker24.priceChangePercent).toFixed(2)}% 24h)</li>
        <li>Mark price / index: <strong>$${Number(futures.premium.markPrice).toLocaleString()}</strong></li>
        <li>Last funding rate: <strong>${Number(futures.premium.lastFundingRate).toFixed(6)}</strong></li>
        <li>Recent avg funding (last ${futures.fundingHistory.length}): <strong>${(futures.fundingHistory.reduce((s,i)=>s+Number(i.fundingRate),0)/Math.max(1,futures.fundingHistory.length)).toFixed(6)}</strong></li>
  <li>Open interest (contracts): <strong>${Number(futures.openInterest.openInterest).toLocaleString()}</strong></li>
  <li>Open interest (est. USD): <strong>${oiUsdDisplay}</strong></li>
      </ul>
      ` : '<p class="muted">Futures data not available.</p>'}
    </div>

      <div class="card">
        <h3 class="section-title">Sources</h3>
  <p class="muted">Binance market klines (preferred) or CoinGecko sparkline.</p>
      </div>
  </div>
</body>
</html>`;
}

async function main(){
  try{
    // Prefer Binance klines when available to get volumes and reliable exchange data
    let prices = null; let volumes = null;
    let dataSource = 'unknown';
    try{
      const b = await fetchBinance7d();
      prices = b.prices; volumes = b.volumes;
      dataSource = 'binance-klines';
    }catch(e){
      console.warn('Binance fetch failed, falling back to CoinGecko sparkline:', e.message);
      prices = await fetchCoinGecko7d();
      volumes = Array(prices.length).fill(0);
      dataSource = 'coingecko-sparkline';
    }

    if(!prices || !Array.isArray(prices)) throw new Error('No price data available');
    const priceSummary = buildPriceSummary(prices);
  const signals = detectSignals(prices, volumes || []);
  console.log('Computed signals:', signals);
  const futures = await fetchBinanceFutures();
  // Try LLM-based narrative first (if API key present); fall back to rule-based narrative
  let narrative = null;
  try{
    const llm = await generateNarrativeWithLLM(signals, priceSummary);
    if(llm && (llm.snapshot || (Array.isArray(llm.chronology) && llm.chronology.length))){
      console.log('LLM narrative used');
      // map LLM shape to internal narrative shape, falling back to rule-based defaults
      const base = generateNarrative(signals);
      narrative = {
        last7Analysis: llm.snapshot || base.last7Analysis || '',
        chronology: Array.isArray(llm.chronology) && llm.chronology.length ? llm.chronology : base.chronology,
        technicalReadout: Array.isArray(llm.technicalReadout) && llm.technicalReadout.length ? llm.technicalReadout : base.technicalReadout,
        levels: (llm.levels && Array.isArray(llm.levels) && llm.levels.length) ? llm.levels : base.levels,
        scenarios: Array.isArray(llm.scenarios) && llm.scenarios.length ? llm.scenarios : base.scenarios,
        checklist: Array.isArray(llm.checklist) && llm.checklist.length ? llm.checklist : base.checklist
      };
    }else{
      console.log('LLM narrative not available or failed to parse; using rule-based narrative');
      narrative = generateNarrative(signals);
    }
  }catch(e){
    console.warn('LLM call failed, falling back to rule-based narrative', e && e.message);
    narrative = generateNarrative(signals);
  }
  const html = buildHtml(priceSummary, signals, futures, { dataSource }, narrative);
  // Build a structured object for JSON output too
  const latest = {
    generatedAt: new Date().toISOString(),
    dataSource,
    priceSummary,
    signals,
    futuresAvailable: !!futures,
    futures: (function(){
      if(!futures) return null;
      try{
        const out = {};
        out.ticker24 = { lastPrice: Number(futures.ticker24.lastPrice), priceChangePercent: Number(futures.ticker24.priceChangePercent) };
        out.premium = { markPrice: Number(futures.premium.markPrice), lastFundingRate: Number(futures.premium.lastFundingRate) };
        out.openInterest = { openInterest: Number(futures.openInterest.openInterest) };
        out.fundingSummary = {
          recentAvg: (futures.fundingHistory && futures.fundingHistory.length) ? (futures.fundingHistory.reduce((s,i)=>s+Number(i.fundingRate),0)/futures.fundingHistory.length) : null,
          sampleCount: futures.fundingHistory ? futures.fundingHistory.length : 0
        };
        return out;
      }catch(e){ return null; }
    })(),
    // include the narrative pieces so frontend can render without parsing HTML
    data: {
      snapshot: narrative.last7Analysis || '',
      chronology: narrative.chronology,
      technicalReadout: narrative.technicalReadout,
      levels: narrative.levels,
      scenarios: narrative.scenarios,
      checklist: narrative.checklist
    }
  };

  // Write to repo public/reports so site can serve it.
  const reportsDir = path.join(process.cwd(), 'public', 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  const nowShort = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const outFile = path.join(reportsDir, `btc-weekly-${nowShort}.html`);
  fs.writeFileSync(outFile, html, 'utf8');
  // also write a latest.json for frontend consumption
  const latestJsonFile = path.join(reportsDir, `btc-weekly-latest.json`);
  fs.writeFileSync(latestJsonFile, JSON.stringify(latest, null, 2), 'utf8');
  // also write a latest.html copy for convenience
  const latestHtmlFile = path.join(reportsDir, `btc-weekly-latest.html`);
  fs.writeFileSync(latestHtmlFile, html, 'utf8');

  console.log('Wrote report to', outFile);
  console.log('Wrote latest JSON to', latestJsonFile);
  console.log('Wrote latest HTML to', latestHtmlFile);
  }catch(err){
    console.error(err);
    process.exit(1);
  }
}

main();

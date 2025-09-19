#!/usr/bin/env node
/*
  Aggregator: fetch trending crypto/blockchain articles from multiple sources
  - NewsAPI (requires NEWSAPI_KEY env)
  - Reddit (public JSON endpoints)
  - Decrypt RSS

  Usage examples:
    $env:NEWSAPI_KEY='...' ; node scripts/fetch-trending-aggregator.js
    node scripts/fetch-trending-aggregator.js --sources=newsapi,reddit,google,decrypt --hours=6 --out=./tmp/trending.json

  Options:
    --sources=csv     Comma-separated list: newsapi,reddit,google,decrypt
    --hours=N         How many hours in the past to consider (default 6)
    --out=PATH        Write raw JSON output to PATH

  Notes:
    - This is a basic aggregator for convenience and prototyping.
    - NewsAPI may require a paid plan to see all sources and avoid rate limits.
    - RSS parsing uses JSDOM (already in project deps) to avoid adding new libraries.
*/

const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const crypto = require('crypto');

function isoHoursAgo(h){ return new Date(Date.now() - h * 3600 * 1000); }
function toISO(d){ return d ? new Date(d).toISOString() : null; }

function sleep(ms){ return new Promise(r => setTimeout(r, ms)) }

// Helper: fetch with abort timeout and optional per-request timeout override
async function fetchWithTimeout(url, opts = {}, timeoutMs = 3000){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeout = null;
  try{
    if (controller) opts.signal = controller.signal;
    const p = fetch(url, opts);
    if (controller) timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await p;
    return res;
  }catch(err){
    throw err;
  }finally{
    if (timeout) clearTimeout(timeout);
  }
}

// NewsAPI removed (no API key). Instead we fetch X via Nitter RSS and other public RSS feeds.

async function fetchNitterSearchRSS(hours){
  // Use public Nitter instances that provide RSS for search results.
  // Nitter instances availability varies; try a list until one works.
  const instances = [
    'https://nitter.net',
    'https://nitter.snopyta.org',
    'https://nitter.eu'
  ];
  const q = encodeURIComponent('crypto OR blockchain');
  const tries = instances.map(base => `${base}/search/rss?q=${q}`);
  for (const url of tries){
    try{
      const items = await fetchRSS(url, hours, 'x');
      if (items && items.length) return items;
    } catch(e){ /* try next */ }
  }
  return [];
}

async function fetchCoinMarketCapRSS(hours){
  // CoinMarketCap has a headlines RSS; fall back to main news feed
  const url = 'https://coinmarketcap.com/headlines/rss/';
  return fetchRSS(url, hours, 'coinmarketcap');
}

async function fetchfinboldRSS(hours){
  // finbold crypto section RSS
  const url = 'https://www.finbold.com/crypto/index.xml';
  return fetchRSS(url, hours, 'finbold');
}

async function fetchCoinDeskRSS(hours){
  // Aggressive fetch: try each known CoinDesk RSS endpoint with retries, then
  // fall back to Google News RSS searches for coindesk when direct feeds fail.
  const urls = [
    'https://www.coindesk.com/feed',
    'https://www.coindesk.com/rss',
    'https://www.coindesk.com/arc/outboundfeeds/rss/'
  ];
  for (const url of urls){
    for (let attempt = 1; attempt <= 3; attempt++){
      try{
        const items = await fetchRSS(url, hours, 'coindesk')
        if (items && items.length) return items
      }catch(e){ /* ignore and retry */ }
      // small backoff between retries
      await sleep(400 * attempt)
    }
  }

  // If direct feeds failed, try Google News RSS search as a fallback for coindesk items
  const googleFallbacks = [
    'https://news.google.com/rss/search?q=site:coindesk.com+crypto',
    'https://news.google.com/rss/search?q=coindesk+crypto',
    'https://news.google.com/rss/search?q=coindesk'
  ];
  for (const g of googleFallbacks){
    try{
      const items = await fetchRSS(g, hours, 'coindesk')
      if (items && items.length) return items
    }catch(e){ /* ignore */ }
  }

  return []
}

async function fetchReddit(hours){
  // use Reddit search endpoint scoped to new posts in the last hour window; Reddit's 't' param accepts hour but not custom time range
  // We'll fetch 'new' results for popular crypto subreddits and search as fallback
  const cutoff = Math.floor(isoHoursAgo(hours).getTime() / 1000);
  const endpoints = [
    'https://www.reddit.com/r/CryptoCurrency/new.json?limit=100',
    'https://www.reddit.com/r/cryptonews/new.json?limit=100',
    'https://www.reddit.com/search.json?q=crypto%20OR%20blockchain&sort=new&limit=100'
  ];
  const seen = new Set();
  const out = [];
  for (const ep of endpoints){
    try{
      const res = await fetch(ep, { headers: { 'User-Agent': 'cointist-aggregator/1.0' } });
      if (!res.ok) continue;
      const j = await res.json();
      const items = (j.data && j.data.children) || (j.children) || [];
      for (const it of items){
        const d = it.data || it;
        if (!d) continue;
        const created = d.created_utc || d.created || 0;
        if (created < cutoff) continue;
        const url = d.url || (d.permalink ? `https://reddit.com${d.permalink}` : null);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        out.push({
          id: url,
          title: d.title || (d.link_title || ''),
          source: 'reddit',
          url,
          summary: (d.selftext || '').slice(0,400),
          publishedAt: toISO(created * 1000)
        });
      }
    } catch(e){ /* ignore per-source failures */ }
  }
  return out;
}

async function fetchRSS(url, hours, sourceName){
  const MAX_ATTEMPTS = 2;
  // Allow per-source override via env: AGG_RSS_TIMEOUT_MS
  const TIMEOUT_MS = Number(process.env.AGG_RSS_TIMEOUT_MS || 3000); // default 3s per request
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) cointist-aggregator/1.0',
    'Accept': 'text/xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++){
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timeout = null;
    try{
      if (controller) timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      console.error(`[rss-fetch] trying ${url} (attempt ${attempt}/${MAX_ATTEMPTS})`);
  // use fetchWithTimeout which will abort after TIMEOUT_MS
  const res = await fetchWithTimeout(url, { headers }, TIMEOUT_MS);
      if (!res) { console.error(`[rss-fetch] no response for ${url}`); continue }
      if (!res.ok){
        console.error(`[rss-fetch] non-OK response for ${url}: ${res.status} ${res.statusText}`);
        // if rate limited, wait and retry with backoff
        if (res.status === 429){
          const backoff = 400 * Math.pow(2, attempt);
          console.error(`[rss-fetch] 429 for ${url}, backing off ${backoff}ms`);
          await sleep(backoff);
          continue
        }
        return [];
      }

      const text = await res.text();
      const dom = new JSDOM(text, { contentType: 'text/xml' });
      const doc = dom.window.document;
      const items = Array.from(doc.querySelectorAll('item'));
      const cutoff = isoHoursAgo(hours);
      return items.map(it => {
        const titleEl = it.querySelector('title');
        const linkEl = it.querySelector('link');
        const pub = it.querySelector('pubDate');
        const desc = it.querySelector('description') || it.querySelector('content\:encoded');
        const url = linkEl ? linkEl.textContent.trim() : (it.querySelector('guid') ? it.querySelector('guid').textContent.trim() : null);
        // Try to discover an original publisher URL: look for <origLink>, <enclosure url=>, or href inside description
        let orig = null
        try{
          const origEl = it.querySelector('origLink') || it.querySelector('origlink')
          if (origEl && origEl.textContent) orig = origEl.textContent.trim()
          if (!orig){
            const enc = it.querySelector('enclosure')
            if (enc && enc.getAttribute && enc.getAttribute('url')) orig = enc.getAttribute('url')
          }
          if (!orig && desc && desc.textContent){
            const m = desc.textContent.match(/href=\"([^\"]+)\"|href=\'([^\']+)\'|<a[^>]+href=\"([^\"]+)\"/i)
            if (m) orig = (m[1]||m[2]||m[3]||'').trim()
          }
        }catch(e){ /* ignore */ }
        const publishedAt = pub ? new Date(pub.textContent.trim()) : null;
        return {
          id: url || (titleEl && titleEl.textContent) || Math.random().toString(36).slice(2),
          title: titleEl ? titleEl.textContent.trim() : '(no title)',
          source: sourceName,
          url,
          orig_url: orig || null,
          summary: desc ? desc.textContent.trim() : '',
          publishedAt: publishedAt ? publishedAt.toISOString() : null
        };
      }).filter(a => {
        if (!a.publishedAt) return true; // keep items without pubDate
        return new Date(a.publishedAt) >= cutoff;
      });
    }catch(err){
      const isAbort = err && (err.name === 'AbortError' || err.type === 'aborted');
      console.error(`[rss-fetch] error fetching ${url} (attempt ${attempt}): ${isAbort ? 'timeout' : (err && err.message ? err.message : err)}`);
      // if aborted/timed out, retry a couple times
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 300 * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }
      return [];
    }finally{
      if (timeout) clearTimeout(timeout);
    }
  }
  return [];
}

// Google News RSS removed: source deprecated/removed from pipeline

async function fetchDecryptRSS(hours){
  const url = 'https://decrypt.co/feed';
  return fetchRSS(url, hours, 'decrypt');
}

// Generic site RSS probe: try common feed URL patterns for many crypto publishers.
// Note: we try a list of likely feed endpoints and return the first non-empty result.
async function fetchSiteRSS(siteKey, hours){
  const domains = {
    cointelegraph: 'cointelegraph.com',
    ambcrypto: 'ambcrypto.com',
    newsbtc: 'www.newsbtc.com',
    bitcoinmagazine: 'bitcoinmagazine.com',
    theblock: 'www.theblock.co',
    cryptonews: 'cryptonews.com',
    btcmanager: 'btcmanager.com',
    beincrypto: 'beincrypto.com',
    coingape: 'www.coingape.com',
    utoday: 'u.today',
    coinspeaker: 'www.coinspeaker.com',
    cryptopotato: 'cryptopotato.com',
    coinrivet: 'coinrivet.com',
    coinjournal: 'coinjournal.net',
    thedailyhodl: 'thedailyhodl.com',
    cointelegraphuk: 'cointelegraph.com',
    cointelegraphasia: 'cointelegraph.com',
    decrypt: 'decrypt.co',
    coinmarketcap: 'coinmarketcap.com',
    finbold: 'www.finbold.com',
    coinsutra: 'coinsutra.com',
    cryptobriefing: 'www.cryptobriefing.com',
    coinmarketcal: 'coinmarketcal.com',
    coinpaprika: 'coinpaprika.com',
    cryptoslate: 'cryptoslate.com',
    blockworks: 'blockworks.co',
    thedefiant: 'thedefiant.io',
    coinspectator: 'coinspectator.com',
    cointelegraphfr: 'cointelegraph.com',
    cointelegraphes: 'cointelegraph.com',
    cointelegraphjp: 'cointelegraph.com'
  };
  const domain = domains[siteKey] || siteKey;
  const candidates = [
    `https://${domain}/rss`,
    `https://${domain}/feed`,
    `https://${domain}/feed/`,
    `https://${domain}/rss.xml`,
    `https://${domain}/feeds/latest`,
    `https://${domain}/feeds/posts/default?alt=rss`
  ];
  for (const url of candidates){
    try{
      const items = await fetchRSS(url, hours, siteKey);
      if (items && items.length) return items;
    }catch(e){ /* try next candidate */ }
    // small delay between attempts to be polite
    await sleep(120);
  }
  return [];
}

async function fetchBinanceTopSearches(hours){
  // Fetch Binance 24h tickers, pick top movers and search news for their base symbols
  try{
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    if (!res.ok) return [];
    const tickers = await res.json();
    // compute percent change and prefer spot tickers quoted in USDT/BUSD (like Binance Top Gainers)
  const preferredQuotes = ['USDT','BUSD'];
  // allow runtime tuning via env or CLI flags
  const TOP_N = Number(process.env.BINANCE_TOP_N || 10);
  // default minimum quote volume $5,000,000 to avoid low-liquidity tokens
  const MIN_QUOTE_VOLUME = Number(process.env.BINANCE_MIN_QUOTE_VOLUME || 5000000);
  const list = tickers
    .map(t => ({ symbol: String(t.symbol||''), pct: Number(t.priceChangePercent || 0), quoteVolume: Number(t.quoteVolume || 0) }))
    .filter(t => preferredQuotes.some(q => t.symbol.endsWith(q)) && t.quoteVolume >= MIN_QUOTE_VOLUME);
  // sort descending by percent change and take the absolute top N gainers
  list.sort((a,b)=> (Number(b.pct) || 0) - (Number(a.pct) || 0));
  const top = list.slice(0, TOP_N);
  console.error(`[binance-top] selected ${top.length} top tickers from preferred quotes: ${preferredQuotes.join(',')} (TOP_N=${TOP_N}, MIN_QUOTE_VOLUME=${MIN_QUOTE_VOLUME})`);
    const knownQuotes = ['USDT','BUSD','USDC','BTC','ETH','TUSD','EUR','GBP','TRY','BNB'];
  const bases = new Set();
    for (const t of top){
      let s = t.symbol || '';
      for (const q of knownQuotes){ if (s.endsWith(q)) { s = s.slice(0, -q.length); break; } }
      s = s.trim();
      if (s && s.length>1) bases.add(s);
    }
  console.error(`[binance-top] selected ${bases.size} base symbols from top ${top.length} tickers`);
    // Always include any manually configured symbols (comma-separated env var)
    // This helps surface small-cap symbols like MYX that may not meet the pct threshold
    let alwaysList = [];
    try{
      alwaysList = (process.env.BINANCE_ALWAYS_SEARCH || '').split(',').map(x=>x.trim()).filter(Boolean);
      for (const a of alwaysList) bases.add(a);
    }catch(e){ /* ignore env parsing issues */ }
    if (alwaysList.length) console.error(`[binance-top] enforced whitelist symbols: ${alwaysList.join(',')}`);
    const out = [];
    for (const b of Array.from(bases)){
      // build a Google News RSS search for this symbol (look for 'symbol crypto' or 'symbol token')
      const q = encodeURIComponent(`${b} crypto OR ${b} token OR ${b} coin`);
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
      try{
  // Use the same configured window (24 hours by default) for Binance searches.
  // Keep the search window consistent with the user's request.
  const binanceHours = hours;
  console.error(`[binance-search] fetching ${b} -> ${url} (hours=${binanceHours})`);
        // perform raw fetch to capture HTTP status for logging, then hand text to RSS parser
        // Allow per-request timeout override via env: AGG_BINANCE_TIMEOUT_MS
        const BIN_TIMEOUT = Number(process.env.AGG_BINANCE_TIMEOUT_MS || 3000);
        const rawRes = await fetchWithTimeout(url, { headers: { 'User-Agent': 'cointist-aggregator/1.0' } }, BIN_TIMEOUT);
        if (!rawRes || !rawRes.ok) {
          if (rawRes) console.error(`[binance-search] HTTP ${rawRes.status} ${rawRes.statusText} for ${url}`);
          else console.error(`[binance-search] no response for ${url}`);
        } else {
          const rawText = await rawRes.text();
          // parse items via JSDOM (same logic as fetchRSS)
          try {
            const dom = new JSDOM(rawText, { contentType: 'text/xml' });
            const doc = dom.window.document;
            const items = Array.from(doc.querySelectorAll('item')).map(it => {
              const titleEl = it.querySelector('title');
              const linkEl = it.querySelector('link');
              const pub = it.querySelector('pubDate');
              const desc = it.querySelector('description') || it.querySelector('content\:encoded');
              const url = linkEl ? linkEl.textContent.trim() : (it.querySelector('guid') ? it.querySelector('guid').textContent.trim() : null);
              const publishedAt = pub ? new Date(pub.textContent.trim()) : null;
              return {
                id: url || (titleEl && titleEl.textContent) || Math.random().toString(36).slice(2),
                title: titleEl ? titleEl.textContent.trim() : '(no title)',
                source: `binance-${b}`,
                url,
                summary: desc ? desc.textContent.trim() : '',
                publishedAt: publishedAt ? publishedAt.toISOString() : null
              };
            }).filter(a => {
              if (!a.publishedAt) return true;
              return new Date(a.publishedAt) >= isoHoursAgo(binanceHours);
            });
            const cnt = items.length;
            // limit the number of articles we include per coin to avoid heavy results
            const limited = items.slice(0, 3);
            console.error(`[binance-search] parsed ${cnt} items for ${b}, pushing ${limited.length} items`);
            if (limited.length) out.push(...limited);
          } catch(parseErr){
            console.error(`[binance-search] parse error for ${b}:`, parseErr && parseErr.message ? parseErr.message : parseErr);
          }
        }
      }catch(e){
        console.error(`[binance-search] error fetching ${b}:`, e && e.message ? e.message : e);
      }
      // slightly longer delay to avoid overly rapid requests against Google News
      await new Promise(r => setTimeout(r, 250));
    }
    return out;
  }catch(e){ return []; }
}

function dedupeAndSort(items){
  const seen = new Set();
  const out = items.filter(it => {
    if (!it || !it.url) return false;
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
  out.sort((a,b)=>{
    const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tb - ta;
  });
  return out;
}

async function main(){
  const argv = require('minimist')(process.argv.slice(2));
  const hours = Number(argv.hours || 12);
  // defaultSources: include CoinDesk and X (via Nitter) plus a broad set of crypto publishers
  // NOTE: reddit results are intentionally excluded from the aggregated feed to avoid noisy community posts
  let defaultSources = [
    'decrypt','nitter','coinmarketcap','finbold','coindesk','cointelegraph','coinspeaker','cryptonews','thedailyhodl',
    'cointelegraphuk','cointelegraphasia','coinjournal','cryptopotato','coinsutra','ambcrypto','newsbtc','bitcoinmagazine',
    'beincrypto','btcmanager','utoday','cryptobriefing','theblock','coinrivet','coinmarketcal','coinpaprika',
    'cryptoslate','blockworks','thedefiant','coinspectator'
  ];
  // If BINANCE_ALWAYS_SEARCH is set, ensure 'binance' source is included so targeted searches run
  try{
    const envList = String(process.env.BINANCE_ALWAYS_SEARCH || '').split(',').map(x=>x.trim()).filter(Boolean);
    if (envList.length > 0) {
      if (!defaultSources.includes('binance')) {
        defaultSources.push('binance');
        console.error(`[main] BINANCE_ALWAYS_SEARCH detected, forcing 'binance' source and adding symbols: ${envList.join(',')}`);
      }
    }
  }catch(e){ /* ignore */ }
  // Allow extra sources via --extra or AGG_EXTRA_SOURCES env var (comma-separated)
  const extraCli = argv.extra ? String(argv.extra).split(',').map(x=>x.trim()).filter(Boolean) : [];
  const extraEnv = String(process.env.AGG_EXTRA_SOURCES || '').split(',').map(x=>x.trim()).filter(Boolean);
  const baseSources = (argv.sources ? String(argv.sources).split(',') : defaultSources).map(s=>s.trim()).filter(Boolean);
  const sources = Array.from(new Set([...baseSources, ...extraEnv, ...extraCli]));
  const outPath = argv.out;

  const pulls = [];
  for (const s of sources){
    // reddit intentionally disabled — skip even if provided in --sources
    if (s === 'reddit') { console.error('[main] reddit source disabled by configuration; skipping'); continue }
    if (s === 'decrypt') { pulls.push(fetchDecryptRSS(hours)); continue }
    if (s === 'nitter' || s === 'x') { pulls.push(fetchNitterSearchRSS(hours)); continue }
    if (s === 'coinmarketcap') { pulls.push(fetchCoinMarketCapRSS(hours)); continue }
    if (s === 'finbold') { pulls.push(fetchfinboldRSS(hours)); continue }
    if (s === 'coindesk') { pulls.push(fetchCoinDeskRSS(hours)); continue }
    if (s === 'binance') { pulls.push(fetchBinanceTopSearches(hours)); continue }
    // Generic site probe: for smaller publishers specified by key (e.g. 'cointelegraph', 'coinspeaker')
    // fall back to fetchSiteRSS which tries common feed endpoints for that site key.
    try{
      pulls.push(fetchSiteRSS(s, hours));
    }catch(e){ console.error(`[main] fetchSiteRSS failed for ${s}:`, e && e.message ? e.message : e) }
  }

  const results = await Promise.all(pulls.map(p=>p.catch(e=>{ console.error('source failure', e && e.message); return []; })));
  const all = results.flat();
  const final = dedupeAndSort(all).slice(0,200);

  // Ensure stable canonical IDs for downstream pipeline: prefer existing id, otherwise compute SHA1(url|title|publishedAt)
  for (const a of final) {
    try {
      if (!a || !a.id) {
        const key = String(a.url || '') + '|' + String(a.title || '') + '|' + String(a.publishedAt || '');
        a.id = crypto.createHash('sha1').update(key).digest('hex');
      }
    } catch (e) {
      // fallback: use short random id
      if (a && !a.id) a.id = Math.random().toString(36).slice(2, 10);
    }
  }

  console.log(`Aggregated ${final.length} unique articles from: ${sources.join(', ')}`);
  final.forEach((a,i)=>{
    console.log(`${i+1}. ${a.title}`);
    console.log(`   ${a.source} • ${a.publishedAt || ''}`);
    console.log(`   ${a.url}`);
  });

  if (outPath){
    fs.writeFileSync(outPath, JSON.stringify(final, null, 2), 'utf8');
    console.error(`Wrote ${final.length} articles to ${outPath}`);
  }
}

if (require.main === module) main();

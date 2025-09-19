const https = require('https');

// Simple in-memory cache to avoid hitting Binance on every request
let _cache = { ts: 0, data: null };
const CACHE_TTL_MS = 15 * 1000; // 15s

function getJson(url){
  return new Promise((resolve,reject)=>{
    let data='';
    https.get(url, { headers:{ 'User-Agent':'node.js','Accept':'application/json' } }, (res)=>{
      res.on('data', c=>data+=c);
      res.on('end', ()=>{
        try{ if(res.statusCode>=200 && res.statusCode<300) return resolve(JSON.parse(data));
             return reject(new Error(`Fetch failed ${res.statusCode}`));
        }catch(e){ reject(e); }
      });
    }).on('error', reject);
  });
}

export default async function handler(req, res){
  try{
    const now = Date.now();
    if(_cache.data && (now - _cache.ts) < CACHE_TTL_MS){
      return res.status(200).json({ cached: true, ..._cache.data });
    }
    const base = 'https://fapi.binance.com';
    const endpoints = {
      premium: `${base}/fapi/v1/premiumIndex?symbol=BTCUSDT`,
      openInterest: `${base}/fapi/v1/openInterest?symbol=BTCUSDT`,
      ticker24: `${base}/fapi/v1/ticker/24hr?symbol=BTCUSDT`,
      fundingHistory: `${base}/fapi/v1/fundingRate?symbol=BTCUSDT&limit=10`
    };
    const [premium, openInterest, ticker24, fundingHistory] = await Promise.all([
      getJson(endpoints.premium).catch(e=>null),
      getJson(endpoints.openInterest).catch(e=>null),
      getJson(endpoints.ticker24).catch(e=>null),
      getJson(endpoints.fundingHistory).catch(e=>null)
    ]);
    const out = { premium, openInterest, ticker24, fundingHistory };
    _cache = { ts: now, data: out };
    return res.status(200).json({ cached:false, ...out });
  }catch(e){
    console.error('API /api/futures error', e && e.message);
    return res.status(500).json({ error: e && e.message });
  }
}

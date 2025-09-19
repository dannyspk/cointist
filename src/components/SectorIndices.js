import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image'

const SECTORS = [
  { name: "L1 Majors", desc: "Top 3 tokens", ids: ["bitcoin","ethereum","solana","binancecoin","avalanche-2"] },
  { name: "DeFi Bluechips", desc: "Top 3 tokens", ids: ["uniswap","aave","maker","curve-dao-token","compound-governance-token"] },
  { name: "Oracles", desc: "Top 3 tokens", ids: ["chainlink","band-protocol","api3"] },
  { name: "L2 / Scaling", desc: "Top 3 tokens", ids: ["arbitrum","optimism","polygon","starknet"] },
  { name: "Stablecoins", desc: "Top 3 tokens", ids: ["tether","usd-coin","dai","frax"] },
  { name: "AI & Big Data", desc: "Top 3 tokens", ids: ["fetch-ai","render-token","singularitynet","ocean-protocol"] },
  { name: "Gaming", desc: "Top 3 tokens", ids: ["immutable-x","axie-infinity","the-sandbox","decentraland"] },
  { name: "Privacy", desc: "Top 3 tokens", ids: ["monero","zcash","secret"] },
  { name: "NFT", desc: "Top 3 tokens", ids: ["apecoin","blur","decentraland"] },
  { name: "DEX", desc: "Top 3 tokens", ids: ["uniswap","curve-dao-token","sushiswap","balancer"] },
  { name: "Liquid Staking", desc: "Top 3 tokens", ids: ["lido-dao","rocket-pool","frax-ether"] },
  { name: "RWA", desc: "Top 3 tokens", ids: ["pendle","centrifuge","polymesh"] },
];

function fNum(n){ return n>=1e12?(n/1e12).toFixed(2)+'T' : n>=1e9?(n/1e9).toFixed(2)+'B' : n>=1e6?(n/1e6).toFixed(2)+'M' : n>=1e3?(n/1e3).toFixed(2)+'K' : n.toFixed(0); }

function computeSnapshot(mkts){
  const totalMC = mkts.reduce((s,c)=> s + (c.market_cap||0), 0);
  if (!totalMC) return { change:0, value:'$0', weights:{}, assets:[], series:[] };
  const weights = Object.fromEntries(mkts.map(c => [c.id, (c.market_cap||0)/totalMC]));
  let change = 0; for (const c of mkts){ const w = weights[c.id]||0; const ch = c.price_change_percentage_24h||0; change += w * ch; }
  const assets = mkts.map(c => ({ name:c.name, symbol:c.symbol?.toUpperCase(), icon:c.image, weight:(weights[c.id]*100).toFixed(1), price:c.current_price, change:c.price_change_percentage_24h })).sort((a,b)=>b.weight-a.weight).slice(0,3);
  return { change, value:'$'+fNum(totalMC), weights, assets };
}

function buildSectorSeries(mkts, weights){
  if (!mkts.length) return [];
  const len = Math.min(...mkts.map(c => (c.sparkline_in_7d?.price||[]).length)) || 0;
  if (!len) return [];
  return Array.from({length: len}, (_, i) => {
    let sum = 0;
    for (const c of mkts){
      const arr = c.sparkline_in_7d.price;
      const base = arr[0] || 1;
      const norm = base ? (arr[i] / base) : 1;
      sum += (weights[c.id]||0) * norm;
    }
    return sum * 100;
  });
}

function sparkPath(values, w, h, pad=2){
  if (!values || !values.length) return { line:'', area:'' };
  const min = Math.min(...values), max = Math.max(...values), span = (max-min)||1;
  const innerW = w - pad*2, innerH = h - pad*2;
  const pts = values.map((v,i)=>[ pad + (i/(values.length-1))*innerW, pad + innerH - ((v-min)/span)*innerH ]);
  const line = 'M ' + pts.map(p=>p.join(' ')).join(' L ');
  const area = line + ` L ${pad+innerW} ${pad+innerH} L ${pad} ${pad+innerH} Z`;
  return { line, area };
}

export default function SectorIndices(){
  const [sectorData, setSectorData] = useState(Array(SECTORS.length).fill(null));
  const [current, setCurrent] = useState(0);
  const autoRef = useRef(null);
  // Align with existing client-side polling used elsewhere (90s) to avoid CoinGecko rate limits
  const REFRESH_INTERVAL = 90 * 1000;

  useEffect(()=>{
    let mounted = true;

    // Batch-fetch all unique coin ids in one request, then derive per-sector snapshots client-side.
    async function fetchAll(){
      const uniqueIds = Array.from(new Set(SECTORS.flatMap(s => s.ids)));
      if (!uniqueIds.length) return;
      const proxyUrl = '/api/coingecko?url=' + encodeURIComponent(`coins/markets?vs_currency=usd&ids=${uniqueIds.join(',')}&sparkline=true&price_change_percentage=24h&per_page=${uniqueIds.length}`);
      try{
        const res = await fetch(proxyUrl);
        if (!res.ok) {
          if (res.status === 429) console.warn('[SectorIndices] CoinGecko 429 rate limit');
          throw new Error('fetch failed');
        }
        let mkts = await res.json();
        if (!Array.isArray(mkts)) mkts = Object.values(mkts || {});
        // build quick lookup map by id and symbol
        const map = new Map();
        for (const c of mkts){ if (!c) continue; map.set(c.id, c); if (c.symbol) map.set(String(c.id).toLowerCase(), c); }

        const next = SECTORS.map(sector => {
          const sectorMkts = sector.ids.map(id => map.get(id)).filter(Boolean);
          const snap = computeSnapshot(sectorMkts);
          snap.series = buildSectorSeries(sectorMkts, snap.weights);
          return snap;
        });

        if (!mounted) return;
        setSectorData(next);
      }catch(e){
        if (!mounted) return;
        console.error('[SectorIndices] fetch error', e && e.message ? e.message : e);
        setSectorData(Array(SECTORS.length).fill(null));
      }
    }

    // Initial load
    fetchAll();

    // Periodic refresh (batch)
    const refreshTimer = setInterval(()=>{ fetchAll(); }, REFRESH_INTERVAL);

    return ()=>{ mounted = false; clearInterval(refreshTimer); }
  }, []);

  useEffect(()=>{
    // auto-loop sectors
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(()=> setCurrent(c => (c+1) % SECTORS.length), 6000);
    return ()=> clearInterval(autoRef.current);
  }, []);

  const show = (i)=> setCurrent(((i%SECTORS.length)+SECTORS.length)%SECTORS.length);

  const data = sectorData[current] || { value: '…', change: 0, assets: [], series: [] };
  const series = data.series || [];
  const { line, area } = sparkPath(series, 160, 48, 3);

  return (
    <aside id="sector-indices">
      <div className="widget">
        <h3 className="sector-indices-title">Sector Indices</h3>
        <div className="sector-indices-visual">
          <div className="sector-indices-panel">
            <button id="sector-prev" onClick={()=> show(current-1)} aria-label="Previous" className="sector-nav">‹</button>
            <div id="sector-card" className="crypto-index-card" >
              <div className="sector-card-head">
                <span id="sector-name" className="sector-name">{SECTORS[current].name}</span>
                <span id="sector-desc" className="sector-desc">{SECTORS[current].desc}</span>
              </div>
              <div className="sector-card-values">
                <span id="sector-value" className="sector-value">{data.value}</span>
                <div id="sector-change" className="sector-change" style={{ color: (data.change>=0? '#14f195' : '#ff4e4e') }}>{(data.change>=0?'+':'')+Number(data.change||0).toFixed(2)+'%'}</div>
              </div>
              <div className="sector-sparkline-wrap">
                <svg width="100%" height="48" viewBox="0 0 160 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d={line} id="sector-sparkline-path" stroke="#14f195" strokeWidth="3" fill="none" />
                  <path d={area} id="sector-sparkline-fill" fill="url(#sparkfill)" />
                  <defs>
                    <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stopColor="#14f195" stopOpacity="0.18" />
                      <stop offset="1" stopColor="#14f195" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="sector-assets-title">TOP ASSETS BY WEIGHT</div>
              <div id="sector-assets" className="sector-assets">
                {data.assets && data.assets.length ? data.assets.map(a=> (
                  <div className="sector-row" key={a.name}>
                    <span className="sector-row-left"><img src={a.icon} alt={a.name ? `${a.name} icon` : 'asset icon'} style={{ width:20, height:20, marginRight:8 }} /> <strong>{a.name}</strong> <span className="symbol">{a.symbol}</span></span>
                    <span className="sector-row-right">{a.weight}%</span>
                  </div>
                )) : (<div className="loading">Loading…</div>)}
              </div>
            </div>
            <button id="sector-next" onClick={()=> show(current+1)} aria-label="Next" className="sector-nav right">›</button>
          </div>
          <div id="sector-indicators" className="sector-indicators">
            {SECTORS.map((_,i)=> (
              <button key={i} onClick={()=> show(i)} className={i===current? 'active' : ''} style={{ width:10, height:10, borderRadius:10, background: i===current? '#14f195' : '#23292a', border:'1.5px solid #14f195', margin:4 }} aria-label={`Show ${SECTORS[i].name}`} />
            ))}
          </div>
          <div className="crypto-report-section">
            <Image src="/assets/cryptoreporrtt.webp" alt="Q2 Crypto Report" className="crypto-report-thumb" width={240} height={140} />
            <div className="crypto-report-desc">Download our exclusive Q2 report for key trends, sector performance, and expert insights on the crypto market.</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AnalysisSection({ items = null, showHeader = true }){
  // items: optional array of {key:'bitcoin'|'eth'|'crypto', title, excerpt, img, href}
  const defaults = [
    { key: 'bitcoin', title: 'This Week in Bitcoin', excerpt: 'Weekly roundup of on-chain flows, miner activity, significant transfers, and protocol-level updates affecting Bitcoin fundamentals.', img: '/assets/btc-weekly-cover.png', href: '/analysis/bitcoin' },
    { key: 'ethereum', title: 'This Week in Ethereum', excerpt: 'Overview of network health, gas & fee trends, staking/consensus updates, and notable smart-contract activity in the Ethereum ecosystem.', img: '/assets/thisweekineth.png', href: '/analysis/ethereum' },
    { key: 'crypto', title: 'This Week in Crypto', excerpt: 'Concise market summary covering price action, major headlines, regulatory moves, and cross-chain developments to watch this week.', img: '/assets/thisweekincryptothumb.png', href: '/analysis/crypto' }
  ]

  const [metricsMap, setMetricsMap] = useState({})
  const [highlight, setHighlight] = useState(null)
  const [headlines, setHeadlines] = useState([])
  const cards = Array.isArray(items) && items.length ? items : defaults

  function resized(path, w = 420, h = 360){
    if(!path) return path;
    // If path looks external, return as-is
    if(String(path).startsWith('http') || String(path).startsWith('//')) return path;
    return `/api/image-resize?path=${encodeURIComponent(path)}&w=${w}&h=${h}`;
  }

  useEffect(()=>{
    let mounted = true;
    async function load(){
      try{
        const [btcR, ethR] = await Promise.all([
          fetch('/api/btc-weekly').then(r=>r.ok? r.json() : null).catch(()=>null),
          fetch('/api/eth-weekly-metrics').then(r=>r.ok? r.json() : null).catch(()=>null)
        ]);
        const map = {};
        if(btcR && btcR.metrics){ map.bitcoin = btcR.metrics }
        if(ethR && ethR.metrics){ map.ethereum = ethR.metrics }
        if(mounted) setMetricsMap(map);
      }catch(e){ /* ignore */ }
    }
    load();
    // load curated highlight + headlines (public JSON stubs)
    (async ()=>{
      try{
        const h = await fetch('/data/analysis-highlight.json').then(r=>r.ok? r.json() : null).catch(()=>null);
        const hl = await fetch('/data/analysis-headlines.json').then(r=>r.ok? r.json() : []).catch(()=>[]);
        if(mounted){ if(h) setHighlight(h); if(Array.isArray(hl)) setHeadlines(hl); }
      }catch(e){}
    })();
    return ()=>{ mounted=false };
  }, []);

  return (
    <section className="analysis-section full-bleed">
      <div className="analysis-inner">
        <div className="analysis-grid">
          <div className="analysis-left">
            { showHeader ? <h2 className="analysis-title">Weekly Analysis</h2> : null }
            <div className="analysis-cards">
              {cards.map(c => {
                const m = metricsMap[c.key] || {};
                const price = m.currentPrice || m.price || (m.ticker && m.ticker.last) || null;
                const priceLabel = price ? (typeof price === 'number' ? `$${Number(price).toLocaleString(undefined,{maximumFractionDigits:2})}` : String(price)) : null;
                const img = resized(c.img, 420, 260);
                return (
                <article key={c.key} className="analysis-card">
                  <Link href={c.href} legacyBehavior>
                    <a className="card-link">
                      <div className="card-thumb" style={{backgroundImage: `url(${img})`}} aria-hidden />
                      <div className="card-body">
                        <h3 className="card-heading">{c.title}{priceLabel ? <span style={{marginLeft:8, color:'#9bb0ac', fontSize:12}}>· {priceLabel}</span> : null}</h3>
                        <p className="card-excerpt">{c.excerpt}</p>
                      </div>
                    </a>
                  </Link>
                </article>
              )})}
            </div>
          </div>

          <aside className="analysis-right" aria-label="Analysis Suggestions">
            <div className="suggestions">
              <h4>Also in this section</h4>
              { highlight ? (
                <div style={{marginBottom:12, marginTop: 18}}>
                  <a href={highlight.href} style={{color:'#eaf6ef', fontWeight:700, textDecoration:'none'}}>{highlight.title}</a>
                  <div style={{color:'#bcd9c8', fontSize:13, marginTop:6}}>{highlight.excerpt}</div>
                  <div style={{fontSize:12, color:'#9bb0ac', marginTop:6}}>{highlight.author} · {highlight.date}</div>
                </div>
              ) : null }

              { headlines && headlines.length ? (
                <ul style={{marginTop:30, padding:0, listStyle:'none'}}>
                  {headlines.map((h,i)=> (
                    <li key={i} style={{marginBottom:12, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <div style={{display:'flex', gap:8, alignItems:'flex-start'}}>
                        <div style={{width:8, height:8, borderRadius:8, background:'#14f195', marginTop:6, flex:'0 0 8px'}} aria-hidden />
                        <div style={{flex:1}}>
                          <a href={h.href} style={{color:'#bfe9d7', textDecoration:'none', fontSize:13, fontWeight:600}}>{h.title}</a>
                          <div style={{fontSize:12, color:'#9bb0ac', marginTop:6, display:'flex', gap:8, alignItems:'center'}}>
                            <span style={{color:'#9bb0ac'}}>{h.source}</span>
                            <span style={{padding:'2px 6px', background:'rgba(255,255,255,0.02)', borderRadius:6, fontSize:11, color:'#bfcfc0'}}>{h.time}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{color:'#9bb0ac', fontSize:13}}>No headlines available.</div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .analysis-section{ padding: 36px 0; background: background: linear-gradient(180deg, rgb(21 22 22 / 60%), rgba(6, 8, 7, 0.5)); border-top: 1px solid rgba(255,255,255,0.03);  }
  .analysis-inner{  margin: 0 auto; padding: 0 20px }
  /* full-bleed overrides: allow this section to use the full viewport width */
  .analysis-section.full-bleed{ width: 100vw; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw; }
  .analysis-grid{ display: grid; grid-template-columns: 1fr 320px; grid-template-rows: auto 1fr; gap: 20px; align-items: start; }
  .analysis-left{ grid-column: 1; grid-row: 1 / span 2; }
  .analysis-right{ grid-column: 2; grid-row: 2; width: 320px; margin-top: 32px;}

  .analysis-title{ color: #e9f4ef; margin: 0 0 8px; font-size: 32px;     margin-left: 12px; font-weight: 900; letter-spacing: -1px; font-family: var(--font-head); }
  .analysis-cards{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; box-shadow: 0 6px 18px rgba(2,6,9,0.35); }

    .analysis-card{ background: rgba(10,13,12,0.6); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.03); box-shadow: 0 6px 18px rgba(2,6,9,0.35); transition: transform 180ms ease, box-shadow 180ms ease; }
  .card-link{ display:flex; flex-direction:column; gap: 10px; padding: 4px; text-decoration: none; color: inherit; align-items: center; }
  .card-thumb{ width: 100%; height: 340px; background-size: cover; background-position: center; border-radius: 8px; flex: 0 0 auto; box-shadow: inset 0 -30px 60px rgba(0,0,0,0.35); }
  .card-body{ min-width: 0; text-align: center }
    .card-heading{ margin: 0 0 8px; font-size: 18px; font-weight:700; color: #eaf6ef !important; line-height:1.3; }
    .card-excerpt{ margin: 0; color: #bcd9c8; font-size: 13px; line-height:1.45 }
    .price-badge{ display:inline-block; margin-left:8px; background: rgba(0,0,0,0.45); color:#cfe9d6; padding:4px 8px; border-radius:8px; font-size:12px; font-weight:600 }

    .analysis-card:hover{ transform: translateY(-6px); box-shadow: 0 14px 36px rgba(2,6,9,0.45); }

        .suggestions{ box-shadow: 0 6px 18px rgba(2,6,9,0.35); padding: 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.03) }
        .suggestions h4{ margin: 0 0 10px }
        .suggestions ul{ margin:0; padding:0; list-style:none }
        .suggestions li{ margin-bottom:8px }
        .suggestions a{ color: #bfe9d7; text-decoration:none }
        .cta-box{ margin-top:12px; background: rgba(20,241,149,0.06); padding: 12px; border-radius: 8px }
        .cta{ display:inline-block; margin-top:8px; background:#14f195; color:#03281f; text-decoration:none; font-weight:600; padding:8px 12px; border-radius:8px }

        @media (max-width: 980px){
          .analysis-grid{ grid-template-columns: 1fr; grid-template-rows: auto auto; }
          .analysis-left{ grid-column: 1; grid-row: 1; }
          .analysis-right{ grid-column: 1; grid-row: 2; width: 100%; margin-top: 18px; }
          .analysis-cards{ grid-template-columns: repeat(2, 1fr); gap: 12px }
          .card-thumb{ height: 180px; background-size: contain; background-repeat: no-repeat; background-position: center; }
          .card-link{ padding: 10px; align-items: stretch }
          .card-body{ text-align: left; margin-top: 10px;}
          .analysis-title{ font-size: 26px; margin-left: 4px }
        }
        @media (max-width: 600px){
            .analysis-cards{ grid-template-columns: 1fr; gap: 12px }
            .card-thumb{ width: 100%; height: 180px; background-size: contain; background-repeat: no-repeat; background-position: center; }
            .card-link{ padding: 8px; }
            .card-body{ text-align: center; }
            .card-heading{ font-size: 16px; text-align: center; }
            .card-excerpt{ font-size: 13px }
            .analysis-right{ display: none }
            .analysis-inner{ padding: 0 12px }
        }
      `}</style>
    </section>
  )
}

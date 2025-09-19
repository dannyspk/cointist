import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

const MarketMarquee = dynamic(() => import('./MarketMarquee'), { ssr: false, loading: () => <div style={{height:36}} /> });
import SiteFooter from './SiteFooter';

function SmallRow({label, value}){
  return (
    <div className="small-row">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function BtcWeeklyReport({priceSummary='-', signals={}, futures=null, data={}, metrics=null, reports=null, previewMode=false, previewUsedCache=false, hideTechnicalReadout=false, hideScenarios=false}){
  const {chronology = [], technicalReadout = [], levels = [], scenarios = [], checklist = [], snapshot=''} = data;
  const router = useRouter();
  // Determine whether we're actually rendering a preview page. Priority:
  // 1. explicit prop `previewMode` when passed by the caller
  // 2. router pathname that matches the known preview page `/crypto-weekly-preview`
  // 3. fallback to false
  const isPreviewMode = (typeof previewMode === 'boolean' ? previewMode : false) || (router && router.pathname === '/crypto-weekly-preview');
  // Default subject: use provided subject or 'Bitcoin', but prefer 'Altcoins' for preview pages
  const subject = (data && data.subject) || (isPreviewMode ? 'Altcoins' : 'Bitcoin');
  const multiReports = Array.isArray(reports) && reports.length ? reports : (Array.isArray(data && data.reports) ? data.reports : null);
  metrics = metrics || {};
  const [clientMetrics, setClientMetrics] = useState(null);
  const [futuresLive, setFuturesLive] = useState(null);

  function formatPrice(v){
    if(v === null || v === undefined || Number.isNaN(Number(v))) return '-';
    const n = Number(v);
    if(!Number.isFinite(n)) return '-';
    // Large numbers: round to whole dollars
    if(Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString()}`;
    // Dollars >= 1: show max 2 decimals
    if(Math.abs(n) >= 1) return `$${n.toLocaleString(undefined,{maximumFractionDigits:2})}`;
    // Small coins: show up to 6 decimals but trim trailing zeros
    const s = n.toLocaleString(undefined,{maximumFractionDigits:6, minimumFractionDigits:2});
    return `$${s.replace(/(?:\.\d*?)0+$/,'').replace(/\.$/,'')}`;
  }

  useEffect(()=>{
    let mounted = true;
    const needFetch = !metrics || metrics.exchangeReserves == null || (metrics.hashrate7dAvg==null && metrics.difficulty==null);
    if(needFetch){
      fetch('/api/btc-weekly').then(r=>r.json()).then(j=>{ if(mounted && j && j.metrics) setClientMetrics(j.metrics); }).catch(()=>{});
    }
    // Fetch live futures data (short TTL) to keep readout fresh
    (async ()=>{
      try{
        const r = await fetch('/api/futures');
        if(!mounted) return;
        if(r && r.ok){
          const j = await r.json();
          // prefer non-null premium/ticker24/openInterest
          if(j && (j.ticker24 || j.premium || j.openInterest)) setFuturesLive(j);
        }
      }catch(e){}
    })();
    return ()=>{ mounted=false; };
  }, []);

  const effectiveMetrics = clientMetrics ? {...metrics, ...clientMetrics} : metrics;

  function formatOpenInterestUsd(n){
    if(!n && n !== 0) return '—';
    const rounded = Math.round(n);
    if(rounded >= 1e9){
      return `${(rounded/1e9).toFixed(2).replace(/\.00$/,'')}B`;
    }
    return rounded.toLocaleString();
  }

  // normalize signals.headlines (support string entries or objects), dedupe and return up to 5 items
  const rawHeadlines = Array.isArray(signals && signals.headlines) ? signals.headlines : [];
  const normalizedHeadlines = (() => {
    const seen = new Set();
    const out = [];
    for (const raw of rawHeadlines) {
      if (!raw) continue;
      let title = '';
      let url = '';
      if (typeof raw === 'string') {
        title = raw.trim();
      } else if (typeof raw === 'object') {
        title = String(raw.title || raw.text || raw.headline || raw.name || '').trim();
        url = raw.url || raw.link || raw.href || '';
        url = url ? String(url).trim() : '';
      }
      if (!title && url) title = url;
      if (!title) continue;
      const key = url || title.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title, url });
      if (out.length >= 5) break;
    }
    // fallback: include first up to 5 raw items
    if (out.length === 0 && rawHeadlines.length) {
      return rawHeadlines.filter(Boolean).slice(0,5).map(h => {
        if (typeof h === 'string') return { title: h, url: '' };
        return { title: String(h.title || h.text || h.headline || h.name || h.url || '').trim(), url: h.url || h.link || h.href || '' };
      });
    }
    return out;
  })();

  // If preview is active and signals didn't provide headlines, try extracting a single headline from each report's first event
  let finalHeadlines = normalizedHeadlines;
  if (isPreviewMode && (!finalHeadlines || finalHeadlines.length === 0) && Array.isArray(reports) && reports.length) {
    const seen = new Set();
    const out = [];
    for (const r of reports) {
      if (!r || !r.data || !Array.isArray(r.data.events) || r.data.events.length === 0) continue;
      const ev = r.data.events[0];
      if (!ev) continue;
      const title = ev.title || ev.headline || ev.description || '';
      const url = ev.url || '';
      const t = String(title || url).trim();
      if (!t) continue;
      const key = (url && String(url).trim()) || t.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ title: t, url: url ? String(url).trim() : '' });
      if (out.length >= 5) break;
    }
    if (out.length) finalHeadlines = out;
  }

  const hasHeadlines = finalHeadlines && finalHeadlines.length > 0;

  // Build a preview-safe checklist: prefer data.checklist only if it references current report names.
  const renderChecklist = (() => {
    try{
      // If not preview mode, use checklist from data directly
      if(!isPreviewMode) return checklist && checklist.length ? checklist : [];
      // Collect a set of report names/symbols to validate checklist freshness
      const names = new Set((Array.isArray(multiReports) ? multiReports : []).map(r => ((r && r.name) || (r && r.symbol) || '').toLowerCase()).filter(Boolean));
      if(Array.isArray(checklist) && checklist.length){
        // If at least one checklist line mentions a current coin name/symbol, consider it fresh
        const mentionsCurrent = checklist.some(line => {
          if(!line) return false;
          const lower = String(line).toLowerCase();
          for(const n of names){ if(n && lower.includes(n)) return true; }
          return false;
        });
        if(mentionsCurrent) return checklist;
      }
      // Otherwise, synthesize checklist from multiReports using the same heuristics as the preview page
      const out = [];
      if(Array.isArray(multiReports)){
        for(const r of multiReports){
          if(!r || !r.name) continue;
          const change = (r.signals && typeof r.signals.change === 'number') ? r.signals.change : null;
          const parts = [];
          if(r.signals && r.signals.volumeSpike) parts.push('Notable recent volume spike');
          if(change !== null){
            if(change >= 5) parts.push(`Strong weekly gain (${change.toFixed(2)}%)`);
            else if(change >= 1) parts.push(`Modest weekly gain (${change.toFixed(2)}%)`);
            else if(change > -1 && change < 1) parts.push('Mixed weekly action');
            else parts.push(`Weekly weakness (${change.toFixed(2)}%)`);
          }
          if(parts.length === 0){
            if(r.data && r.data.snapshot) parts.push(r.data.snapshot);
            else if(r.signals && typeof r.signals.change === 'number') parts.push(`${r.signals.change.toFixed(2)}% over the week`);
            else parts.push('No quick summary');
          }
          out.push(`${r.name} (${r.symbol || ''}): ${parts.join('. ')}`);
        }
      }
      return out;
    }catch(e){ return checklist || []; }
  })();

  // Remove trailing " - Source" or similar suffixes from titles when displaying headlines
  function cleanTitle(title){
    if(!title) return '';
    const t = String(title).trim();
    // Remove common trailing source/author patterns like ' - Bitcoin.com News' or ' - Crypto Briefing'
    // Allow multi-word source names (letters, numbers, dots, ampersands, apostrophes and spaces).
    try{
      // Use a conservative ASCII-friendly class for source names to avoid environments
      // that don't support Unicode property escapes in regexes.
      return t.replace(/\s+[-–—]\s+[A-Za-z0-9\.\&'’\s]{1,100}$/, '').trim();
    }catch(e){
      // Fallback: remove any trailing ' - ...' up to 100 chars
      return t.replace(/\s+[-–—]\s+.{1,100}$/, '').trim();
    }
  }

  return (
    <>
      <MarketMarquee data-primary={true} />
      <div className="report-root wrapper">
        <Head>
          <title>{`Cointist | Analysis > ${subject}${isPreviewMode ? ' ' : ''}`}</title>
          <link rel="stylesheet" href="/reports/report.css" />
          <link rel="stylesheet" href="/reports/report-overrides.css" />
        </Head>

        <div className="page-title">
          <h1 className="page-title">
            <span className="site-name">Cointist</span>
            <span className="divider">|</span>
            <span className="page-section">Analysis</span>
            <span className="chevron">›</span>
            <span className="subject">{subject}</span>
          </h1>
        </div>

        {/* Cover grid: left = cover image, right = author/meta. Use values from data if present. */}
        {(() => {
          const author = (data && (data.author || data.by)) || 'Cointist';
          const published = (data && (data.date || data.published)) || new Date().toISOString().slice(0,10);
          const summary = (data && data.summary) || (data && data.lead) || '';
          return (
            <div className="page-cover-grid" role="region" aria-label="Report cover and metadata">
              <div className="cover-left">
                <img src={(data && data.cover) || '/assets/btc-weekly-cover.png'} alt="This week in Bitcoin" />
              </div>
              <div className="cover-right">
                <div className="report-meta">
                  { summary ? <p className="report-summary">{summary}</p> : null }
                 

                  {multiReports ? (
                    <div className="quick-metrics">
                      <div className="metrics-heading" style={{marginBottom:8, color:'#dfeee6', fontWeight:700}}>This week — Top coins</div>
                      <div style={{height:8}}/>
                      <div className="reports-list">
                        {multiReports.map((r,i)=>{
                          const price = r.metrics && r.metrics.currentPrice ? formatPrice(r.metrics.currentPrice) : (r.signals && r.signals.last ? formatPrice(r.signals.last) : '-');
                          const change = r.signals && typeof r.signals.change === 'number' ? `${r.signals.change.toFixed(2)}%` : '-';
                          const rsi = r.signals && typeof r.signals.rsi === 'number' ? r.signals.rsi.toFixed(1) : '-';
                          return (
                            <div className="report-row" key={r.id || r.symbol || i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                              <div style={{flex:'1 1 50%'}}>
                                <div style={{fontWeight:700}}>{r.name} <span style={{color:'#9fb7a6',fontWeight:400}}>({r.symbol})</span></div>
                                <div style={{fontSize:12,color:'#cfe3d1'}}>{(r.priceSummary||'').split('\n')[0]}</div>
                              </div>
                              <div style={{flex:'0 0 160px',textAlign:'right'}}>
                                <div>{price}</div>
                                <div style={{fontSize:12,color: r.signals && r.signals.change>0 ? '#8fe07f' : '#f08f8f'}}>{change} · RSI {rsi}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{height:12}} />
                      <div className="report-by"><strong>{author}</strong></div>
                      <div className="report-date">{published}</div>
                    </div>
                  ) : (
                    <div className="quick-metrics">
                      <div className="metrics-heading" style={{marginBottom:8, color:'#dfeee6', fontWeight:700}}>Quick metrics snapshot</div>
                      <div style={{height:8}}/>
                      <div className="metrics-list">
                        <SmallRow label="Price (USD)" value={effectiveMetrics.currentPrice ? formatPrice(effectiveMetrics.currentPrice) : (signals.last ? formatPrice(signals.last) : '-')} />
                        <SmallRow label="Hashrate (7d avg)" value={effectiveMetrics.hashrate7dAvg && effectiveMetrics.hashrate7dAvg.value ? `${effectiveMetrics.hashrate7dAvg.value.toFixed(2)} ${effectiveMetrics.hashrate7dAvg.unit}` : '—'} />
                        <SmallRow label="Difficulty" value={effectiveMetrics.difficulty ? Number(effectiveMetrics.difficulty).toLocaleString() : '—'} />
                        <SmallRow label="Exchange reserves" value={(() => {
                          const v = effectiveMetrics.exchangeReserves;
                          if(v===null||v===undefined) return '—';
                          const n = Number(v);
                          if(Number.isNaN(n)) return '—';
                          if(n >= 1e6) return `${(n/1e6).toFixed(2)}M BTC`;
                          return `${Math.round(n).toLocaleString()} BTC`;
                        })()} />
                      </div>

                      <div style={{height:12}} />
                      <div className="report-by"><strong>{author}</strong></div>
                      <div className="report-date">{published}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        <div className="title">
          <div className="brand">
          </div>
        </div>

  <section className={`card ${isPreviewMode ? 'snapshot-center' : ''}`}>
          <h3 className="snapshot-title">Snapshot</h3>
          <p className="snapshot-text">{snapshot || 'No snapshot available.'}</p>
        </section>

        <div className="card">
          <h4 className="section-title">Practical checklist</h4>
          <ul className="checklist">
            {renderChecklist.map((c,i)=>(<li key={i}>{c}</li>))}
          </ul>
        </div>

  

        <div className="grid">
          <main>
            <section className="card side-title">
              <div className="left-title">Week chronology — what happened</div>
              <div className="content">
                <ul>
                  {chronology.map((s,i)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
            </section>

            {!hideTechnicalReadout && (
            <section className="card side-title">
              <div className="left-title">Technical readout</div>
              <div className="content">
                <ul>
                  {technicalReadout.map((s,i)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>
            </section>
            )}

          </main>

          <aside className="aside">
          {!isPreviewMode ? (
            <div className="card aside-card">
              
              <h4 className="section-title">Futures readout</h4>
              <div className="content">
                {(futuresLive || futures) ? (
                  <div>
                    <SmallRow label="Perp last" value={`$${Number((futuresLive && futuresLive.ticker24 && futuresLive.ticker24.lastPrice) || (futures && futures.ticker24 && futures.ticker24.lastPrice)).toLocaleString()}`} />
                    <SmallRow label="Last funding" value={Number((futuresLive && futuresLive.premium && futuresLive.premium.lastFundingRate) || (futures && futures.premium && futures.premium.lastFundingRate)).toFixed(6)} />
                    {/* Binance openInterest is the raw open interest figure (contracts/quantity). Show both raw and an estimated USD value using markPrice for clarity. */}
                    {(() => {
                      const oiContracts = Number((futuresLive && futuresLive.openInterest && futuresLive.openInterest.openInterest) || (futures && futures.openInterest && futures.openInterest.openInterest)) || 0;
                      const mark = Number((futuresLive && futuresLive.premium && futuresLive.premium.markPrice) || (futures && futures.premium && futures.premium.markPrice)) || null;
                      const oiUsd = mark ? oiContracts * mark : null;
                        const fmtUsd = (v)=>{
                          if(!v && v!==0) return '—';
                          const rounded = Math.round(v);
                          if(rounded >= 1e9) return `$${(rounded/1e9).toFixed(2).replace(/\.00$/,'')}B`;
                          return `$${rounded.toLocaleString()}`;
                        };
                        return (
                          <>
                            <SmallRow label="Open interest (contracts)" value={oiContracts ? oiContracts.toLocaleString() : '-'} />
                            <SmallRow label="Open interest (est. USD)" value={oiUsd ? fmtUsd(oiUsd) : '—'} />
                          </>
                        );
                    })()}
                  </div>
                ) : (<div className="muted">Futures data not available</div>)}
              </div>
            </div>
          ) : null}
            {/* Price summary: hide on preview pages */}
            {!isPreviewMode ? (
              <div className="card aside-card">
                <h4 className="section-title">Price summary</h4>
                <pre className="content">{priceSummary}</pre>
              </div>
            ) : null}

            {/* On main analysis pages show a Futures Readout (preview pages show headlines elsewhere) */}
            {!isPreviewMode ? (
              <div className="aside">
                <div className="card aside-card">
                   <h4 className="section-title">Computed signals</h4>
            <div className="content">
              <SmallRow label="Last" value={signals.last ? `$${Number(signals.last).toLocaleString()}` : '-'} />
              <SmallRow label="7d change" value={signals.change ? `${signals.change.toFixed(2)}%` : '-'} />
              <SmallRow label="RSI(14)" value={signals.rsi ? signals.rsi.toFixed(1) : '-'} />
              <SmallRow label="SMA8 / SMA21" value={`${signals.lastSMA8?Math.round(signals.lastSMA8):'-'} / ${signals.lastSMA21?Math.round(signals.lastSMA21):'-'}`} />
            
            </div>
                </div>
              </div>
            ) : null}

            

            {isPreviewMode ? (
            <div className="cardsv aside-cardsv no-grid">
              <h4 className="section-title">Latest Headlines</h4>
              <div className="content">
                {hasHeadlines ? (
                    <ul style={{margin:0}}>
                      {finalHeadlines.slice(0,5).map((h,i)=> (
                        <li key={h.url || h.title || i} style={{marginBottom:10}}>
                          <span style={{color:'#0c0c0cff', fontSize:14}}>{cleanTitle(h.title)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="muted">No headlines available for preview.</div>
                  )}
              </div>
            </div>
            ) : null }
          </aside>
        </div>

        {!hideScenarios && (
        <section className="card scenario-full">
          <h4 className="section-title">Scenario syntheses</h4>
          <div className="scenario-grid">
            {scenarios.map((s,i)=> (
              <div className="scenario" key={i}>
                <div className="scenario-title"><strong>{s.title}</strong></div>
                <div className="scenario-text muted">{s.text}</div>
              </div>
            ))}
          </div>
        </section>
        )}

        <div className="footer">Generated by Cointist · data from Binance & CoinGecko</div>
      </div>
      <SiteFooter />
    </>
  );
}


import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

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

export default function EthWeeklyReport({priceSummary='-', signals={}, futures=null, data={}, metrics=null, previewMode=false}){
  const {chronology = [], technicalReadout = [], levels = [], scenarios = [], checklist = [], snapshot=''} = data;
  metrics = metrics || {};
  const [clientMetrics, setClientMetrics] = useState(null);
  useEffect(()=>{
    // If server didn't provide metrics, try fetching them client-side from our lightweight API endpoint.
    let mounted = true;
    const needFetch = !metrics || (metrics.gasGwei==null && metrics.stakedEth==null && metrics.tvlUsd==null);
    if(needFetch){
      fetch('/api/eth-weekly-metrics').then(r=>r.json()).then(j=>{ if(mounted && j && j.metrics) setClientMetrics(j.metrics); }).catch(()=>{});
    }
    return ()=>{ mounted=false; };
  }, []);
  const effectiveMetrics = clientMetrics ? {...metrics, ...clientMetrics} : metrics;
  const { gasGwei=null, stakedEth=null, validators=null, tvlUsd=null, currentPrice=null } = effectiveMetrics;
  function formatOpenInterestUsd(n){
    if(!n && n !== 0) return '—';
    const rounded = Math.round(n);
    if(rounded >= 1e9){
      return `${(rounded/1e9).toFixed(2).replace(/\.00$/,'')}B`;
    }
    return rounded.toLocaleString();
  }

  function formatUsdShort(v){
    if(v===null||v===undefined) return '—';
    const n = Math.round(Number(v));
    if(Number.isNaN(n)) return '—';
    if(n >= 1e9) return `$${(n/1e9).toFixed(2).replace(/\.00$/,'')}B`;
    return `$${n.toLocaleString()}`;
  }

  return (
    <>
    <MarketMarquee data-primary={true} />
    <div className="report-root wrapper">
      <Head>
        <title>{`Cointist | Analysis > Ethereum${previewMode ? ' (Preview)' : ''}`}</title>
        <link rel="stylesheet" href="/reports/report.css" />
        <link rel="stylesheet" href="/reports/report-overrides.css" />
      </Head>
      <div className="page-title">
          <h1 className="page-title">
            <span className="site-name">Cointist</span>
            <span className="divider">|</span>
            <span className="page-section">Analysis</span>
            <span className="chevron">›</span>
            <span className="subject">Ethereum</span>
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
                  <img src={(data && data.cover) || '/assets/thisweekineth.png'} alt="This week in Ethereum" />
                </div>
                <div className="cover-right">
                  <div className="report-meta">
                    {/* eyebrow removed per design: site/section shown in page heading */}
                    { summary ? <p className="report-summary">{summary}</p> : null }
                   

                    <div className="quick-metrics">
                      <div className="metrics-heading" style={{marginBottom:8, color:'#dfeee6', fontWeight:700}}>Quick metrics snapshot</div>
                      <div style={{height:8}}/>
                      <div className="metrics-list">
                        {/* Only show the requested four metrics: Price, Gas, Staked, TVL */}
                        <SmallRow label="Price (USD)" value={currentPrice ? formatUsdShort(currentPrice) : (signals.last ? `$${Number(signals.last).toLocaleString()}` : '-')} />
                        <SmallRow label="Gas (avg Gwei)" value={gasGwei ? `${gasGwei} gwei` : '—'} />
                        <SmallRow label="Staked ETH / validators" value={(
                          <div className="staked-value" style={{textAlign:'right'}}>
                            <div className="staked-line">{stakedEth ? `${stakedEth.toLocaleString()} ETH` : '—'}</div>
                            <div className="validators-line">{validators ? `${validators.toLocaleString()} validators` : ''}</div>
                          </div>
                        )} />
                        <SmallRow label="TVL" value={tvlUsd ? formatUsdShort(tvlUsd) : '—'} />
                      </div>

                      <div style={{height:12}} />
                      <div className="report-by"><strong>{author}</strong></div>
                      <div className="report-date">{published}</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

      <div className="title">
        <div className="brand">
        </div>
      </div>

      <section className="card">
        <h3 className="snapshot-title">Snapshot</h3>
        <p className="snapshot-text">{snapshot || 'No snapshot available.'}</p>
      </section>

      <div className="card">
        <h4 className="section-title">Practical checklist</h4>
        <ul className="checklist">
          {checklist.map((c,i)=>(<li key={i}>{c}</li>))}
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

          <section className="card side-title">
            <div className="left-title">Technical readout</div>
            <div className="content">
              <ul>
                {technicalReadout.map((s,i)=>(<li key={i}>{s}</li>))}
              </ul>
            </div>
          </section>

          
        </main>
        

        <aside className="aside">
          <div className="card aside-card">
            <h4 className="section-title">Price summary</h4>
            <pre className="content">{priceSummary}</pre>
          </div>
          

          <div className="card aside-card">
            <h4 className="section-title">Computed signals</h4>
            <div className="content">
              <SmallRow label="Last" value={signals.last ? `$${Number(signals.last).toLocaleString()}` : '-'} />
              <SmallRow label="7d change" value={signals.change ? `${signals.change.toFixed(2)}%` : '-'} />
              <SmallRow label="RSI(14)" value={signals.rsi ? signals.rsi.toFixed(1) : '-'} />
              <SmallRow label="SMA8 / SMA21" value={`${signals.lastSMA8?Math.round(signals.lastSMA8):'-'} / ${signals.lastSMA21?Math.round(signals.lastSMA21):'-'}`} />
            
            </div>
          </div>

          <div className="card aside-card">
            <h4 className="section-title">Futures readout</h4>
            <div className="content">
              {futures ? (
                <div>
                  <SmallRow label="Perp last" value={`$${Number(futures.ticker24.lastPrice).toLocaleString()}`} />
                  <SmallRow label="Last funding" value={Number(futures.premium.lastFundingRate).toFixed(6)} />
                  {/* Binance openInterest is the raw open interest figure (contracts/quantity). Show both raw and an estimated USD value using markPrice for clarity. */}
                  {(() => {
                    const oiContracts = Number(futures.openInterest && futures.openInterest.openInterest) || 0;
                    const mark = Number(futures.premium && futures.premium.markPrice) || null;
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
        </aside>
      </div>

    

       {/* Scenario syntheses moved to full-width card */}
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
  <div className="footer">Generated by Cointist · data from Binance & CoinGecko</div>
    </div>
    <SiteFooter />
    </>

    
  );
}

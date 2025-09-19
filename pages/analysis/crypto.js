import React from 'react';
import fs from 'fs';
import path from 'path';
import { getReport } from '../../lib/crypto-weekly';
import BtcWeeklyReport from '../../src/components/BtcWeeklyReport';

export async function getServerSideProps(){
  try{
    // Prefer the generated preview JSON in public/reports when available (fast SSR)
    try{
      const latestPath = path.join(process.cwd(), 'public', 'reports', 'crypto-weekly-preview-latest.json');
      const latestHtmlPath = path.join(process.cwd(), 'public', 'reports', 'crypto-weekly-preview-latest.html');
      if(fs.existsSync(latestPath)){
        const raw = fs.readFileSync(latestPath,'utf8');
        const parsed = JSON.parse(raw);
        if(parsed && parsed.generatedAt && Array.isArray(parsed.reports) && parsed.reports.length){
          parsed.__usedGeneratedLatest = true;
          const latestHtmlUrl = fs.existsSync(latestHtmlPath) ? '/reports/crypto-weekly-preview-latest.html' : null;
          return { props: { payload: parsed, latestHtmlUrl } };
        }
      }
    }catch(e){ /* ignore parse/read errors and continue to cache/generator */ }

    // Prefer the on-disk cached report for preview to avoid running the aggregator on every page load.
    const cachePath = path.join(process.cwd(), 'tmp', 'crypto-weekly-cache.json');
    const ttl = parseInt(process.env.CRYPTO_WEEKLY_TTL_SECONDS || '300', 10);
    let report = null;
    try{
      if(fs.existsSync(cachePath)){
        const stat = fs.statSync(cachePath);
        const age = (Date.now() - stat.mtimeMs) / 1000;
        if(age < ttl){
          report = JSON.parse(fs.readFileSync(cachePath,'utf8'));
          if(report && report.generatedAt && Array.isArray(report.reports) && report.reports.length){
            report.__usedCacheForPreview = true;
          } else {
            report = null;
          }
        }
      }
    }catch(e){ /* ignore cache read errors */ }

    // If no valid cache, generate fresh (this will run the aggregator once and write the cache)
    if(!report){
      report = await getReport();
    }
    const latestHtmlPath2 = path.join(process.cwd(), 'public', 'reports', 'crypto-weekly-preview-latest.html');
    const latestHtmlUrl2 = fs.existsSync(latestHtmlPath2) ? '/reports/crypto-weekly-preview-latest.html' : null;
    return { props: { payload: report, latestHtmlUrl: latestHtmlUrl2 } };
  }catch(e){
    return { props: { payload: null, latestHtmlUrl: null } };
  }
}

export default function CryptoWeeklyPreview({ payload, latestHtmlUrl }){
  if(!payload) return <div>Report generation failed</div>;
  // Pass the first coin report as representative into the BTC layout component, but
  // inject the top-10 summary and main movers into `data.snapshot` and `data.checklist`
  // so `BtcWeeklyReport` will render them inside its existing styled cards.
  const stablecoinIds = ['tether','usd-coin','usdt','usdcoin','usdc'];
  const filteredReports = Array.isArray(payload.reports) ? payload.reports.filter(r => r && r.id && !stablecoinIds.includes((r.id||'').toLowerCase())) : [];
  const first = (filteredReports && filteredReports[0]) ? filteredReports[0] : (payload.reports && payload.reports[0] ? payload.reports[0] : null);

  // Build a checklist array which will be rendered in the "Practical checklist" card.
  const checklist = [];
  if(payload.movers && payload.movers.up && payload.movers.up.length){
    checklist.push('Top gainers: ' + payload.movers.up.map(t => `${t.name} ${t.change.toFixed(2)}%`).join(', '));
  }
  if(payload.movers && payload.movers.down && payload.movers.down.length){
    checklist.push('Top losers: ' + payload.movers.down.map(t => `${t.name} ${t.change.toFixed(2)}%`).join(', '));
  }
  checklist.push(`Market breadth: ${payload.reports.filter(r=>r && r.signals && r.signals.change>0).length} up / ${payload.reports.filter(r=>r && r.signals && r.signals.change<0).length} down.`);

  // Short notes per asset — build concise, non-generic notes using signals to avoid repeating the same generic sentence.
  payload.reports.filter(r=>r && r.id && !['tether','usd-coin','usdt','usdcoin','usdc'].includes((r.id||'').toLowerCase())).forEach(r => {
    const change = (r.signals && typeof r.signals.change === 'number') ? r.signals.change : null;
    const vs = r.signals || {};
    let noteParts = [];
    // Short-term strength indicator
    if(vs.volumeSpike) noteParts.push('Notable recent volume spike');
    // Weekly change characterization
    if(change !== null){
      if(change >= 5) noteParts.push(`Strong weekly gain (${change.toFixed(2)}%)`);
      else if(change >= 1) noteParts.push(`Modest weekly gain (${change.toFixed(2)}%)`);
      else if(change > -1 && change < 1) noteParts.push('Mixed weekly action');
      else noteParts.push(`Weekly weakness (${change.toFixed(2)}%)`);
    }
    // Fallback to existing snapshot if no signals
    if(noteParts.length === 0){
      if(r.data && r.data.snapshot) noteParts.push(r.data.snapshot);
      else if(r.signals && typeof r.signals.change === 'number') noteParts.push(`${r.signals.change.toFixed(2)}% over the week`);
      else noteParts.push('No quick summary');
    }
    checklist.push(`${r.name} (${r.symbol}): ${noteParts.join('. ')}`);
  });

  // Build a chronology array focused on sentiment and real-world events (exclude stablecoins)
  const chronology = [];
  // Collect headlines separately for the right-column Latest Headlines card (one headline per coin)
  const headlines = [];
  payload.reports.filter(r=>r && r.id && !['tether','usd-coin','usdt','usdcoin','usdc'].includes((r.id||'').toLowerCase())).forEach(r=>{
    const parts = [];
    const s = r.signals || {};

    // Derive a short sentiment line (avoid repeating price-level analysis)
    let sentiment = null;
    if(typeof s.change === 'number'){
      const ch = s.change;
      if(ch >= 5) sentiment = 'Bullish sentiment';
      else if(ch >= 1) sentiment = 'Mildly bullish sentiment';
      else if(ch > -1 && ch < 1) sentiment = 'Neutral sentiment';
      else if(ch > -5) sentiment = 'Mildly bearish sentiment';
      else sentiment = 'Bearish sentiment';
    }
    // Use RSI as a secondary signal modifier
    if(sentiment && typeof s.rsi === 'number'){
      if(s.rsi >= 65) sentiment += ' (overbought RSI)';
      else if(s.rsi <= 35) sentiment += ' (oversold RSI)';
    }
    if(sentiment) parts.push(sentiment);

    // Volume / liquidity events as real-world indicators
    if(s.volumeSpike) parts.push('Increased trading activity this week');
    if(s.sweep) parts.push(`Liquidity sweep observed (~${s.maxDropPct?Number(s.maxDropPct).toFixed(1):'?' }% drop)`);

    // Include any explicit event notes already present in the coin's data (these are considered "real-world events")
    if(r.data && Array.isArray(r.data.chronology) && r.data.chronology.length){
      // Add up to 3 notable items from the coin's chronology to avoid verbosity
      const evs = r.data.chronology.slice(0,3).map(e => (typeof e === 'string' ? e : JSON.stringify(e)));
      parts.push(...evs);
    }

    // Collect the first news headline for this coin (store separately) — omit it from chronology
    if(r.data && Array.isArray(r.data.events) && r.data.events.length){
      const ev = r.data.events[0];
      const headline = ev && (ev.title || ev.headline || ev.description) ? (ev.title || ev.headline || ev.description) : null;
      const url = ev && ev.url ? ev.url : null;
      if(headline) headlines.push({ coin: r.name, symbol: r.symbol, title: headline, url });
    }

    const entry = parts.length ? `${r.name} (${r.symbol}): ${parts.join('. ')}` : `${r.name} (${r.symbol}): No significant sentiment signals or real-world events this week`;
    chronology.push(entry);
  });

  // Fallback for preview: if no news API key / no events available, use chronology lines as headlines so preview isn't empty
  if(headlines.length === 0 && chronology.length){
    chronology.slice(0,5).forEach(line => headlines.push({ title: line }));
  }
  // Compute the snapshot to use in the preview: prefer top-level payload.snapshot (matches generated HTML),
  // then per-report snapshot, then a formatted payload.summary.
  const previewSnapshot = (() => {
    if(payload.snapshot) return payload.snapshot;
    if(first && first.data && first.data.snapshot) return first.data.snapshot;
    if(payload.summary){
      const parts = String(payload.summary).split('\n');
      const line1 = parts[0] || '';
      const line2 = parts[1] || '';
      return (<>{/* line1 may contain both Gainers and Losers separated by '•' */}
        <span>
          {
            line1.split(' • ').map((seg,i)=>{
              const lower = seg.toLowerCase();
              if(lower.startsWith('gainers')) return (<span key={i}><span style={{color:'#dfeee6', fontWeight:700}}>Gainers: </span><span style={{color:'#8fe07f'}}>{seg.replace(/^[^:]+:\s*/i,'')}</span>{i < line1.split(' • ').length-1 ? ' • ' : ''}</span>);
              if(lower.startsWith('losers')) return (<span key={i}><span style={{color:'#dfeee6', fontWeight:700}}>Losers: </span><span style={{color:'#f08f8f'}}>{seg.replace(/^[^:]+:\s*/i,'')}</span>{i < line1.split(' • ').length-1 ? ' • ' : ''}</span>);
              return (<span key={i}>{seg}{i < line1.split(' • ').length-1 ? ' • ' : ''}</span>);
            })
          }
        </span>
        <br/>
        <span style={{display:'block', marginTop:6}}>{line2}</span>
      </>);
    }
    return '';
  })();

  const augmentedFirst = first ? {
    ...first,
    data: {
      ...(first.data || {}),
  // Ensure the cover image is set for the preview: prefer a hero property on the report,
  // otherwise fall back to any existing data.cover or the this-week-in-crypto default.
  cover: (first.hero || (first.data && first.data.cover) || '/assets/thisweekincrypto.png'),
  subject: 'Altcoins',
    // Put the computed preview snapshot and checklist into the per-report data for the preview
  snapshot: previewSnapshot,
  checklist: (first && first.data && Array.isArray(first.data.checklist) && first.data.checklist.length) ? first.data.checklist : checklist,
  chronology
    }
  } : null;

  return (
    <div>
      {/* Page-specific CSS: hide the aside column so the chronology card can use full width */}
      <style jsx global>{`
        /* Small tweak: ensure the aside remains visible for Latest Headlines; hide the futures aside card for the preview */
        .report-root .aside .aside-card:nth-of-type(1) { /* price summary - keep but visually minimal */ }
        .report-root .aside .aside-card:nth-of-type(3) { display:none; /* hide futures readout on preview */ }
        .snapshot-text{}
      `}</style>
      <BtcWeeklyReport
        // Show only the Latest Headlines in the computed-signals slot: pass headlines via signals
        priceSummary={''}
        signals={{ headlines }}
        futures={null}
        data={augmentedFirst && augmentedFirst.data}
        metrics={augmentedFirst && augmentedFirst.metrics}
  reports={filteredReports.length ? filteredReports : payload.reports}
  previewMode={true}
        hideTechnicalReadout={true}
        hideScenarios={true}
        // let the component know whether we used the on-disk cache for preview generation
        previewUsedCache={!!payload.__usedCacheForPreview}
      />
    </div>
  );
}

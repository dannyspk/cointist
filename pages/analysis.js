import React from 'react';
import dynamic from 'next/dynamic';
import SEO from '../src/components/SEO';
const BtcWeeklyReport = dynamic(()=>import('../src/components/BtcWeeklyReport'), { ssr:true });

export default function Preview({ payload }){
  <SEO url={'/analysis'} title={"Market analysis  Cointist"} description={"Market analysis and weekly reports: BTC weekly summaries, signals, and futures commentary."} primaryKeyword={"crypto market analysis"} keywords={["market analysis","BTC weekly","crypto signals","on-chain analysis"]} />
  // payload: { priceSummary, signals, futures, data, metrics }
  // provide a minimal fallback just in case
  const fallback = { priceSummary: 'No data', signals: {}, futures: null, data: { snapshot:'', chronology:[], technicalReadout:[], levels:[], scenarios:[], checklist:[] }, metrics: null };
  const p = payload || fallback;
  return (
    <div style={{padding:1}}>
  <SEO url={'/analysis'} title={"Market analysis — Cointist"} description={"Market analysis and weekly reports: BTC weekly summaries, signals, and futures commentary."} keywords={["market analysis","BTC weekly","crypto signals","on-chain analysis"]} />
  <BtcWeeklyReport priceSummary={p.priceSummary} signals={p.signals} futures={p.futures} data={p.data} metrics={p.metrics} previewMode={false} previewUsedCache={false} />
    </div>
  );
}

// Server-side fetch to retrieve live payload from our API so the preview matches generator output
const { getReport } = require('../lib/btc-weekly');
const fs = require('fs');
const path = require('path');

export async function getServerSideProps(context){
  // Allow overriding preview cache TTL via env (seconds). Default to 0 (no-store) for freshest previews.
  const ttl = process.env.PREVIEW_CACHE_TTL_SECONDS ? Number(process.env.PREVIEW_CACHE_TTL_SECONDS) : 0;
  try{
    // Prefer using a generated `btc-weekly-latest.json` when present in public/reports
    let report = null;
    try{
      const latestPath = path.join(process.cwd(), 'public', 'reports', 'btc-weekly-latest.json');
      if(fs.existsSync(latestPath)){
        const txt = fs.readFileSync(latestPath, 'utf8');
        report = JSON.parse(txt);
        // Attempt a lightweight on-demand fetch and only replace futures+metrics
        try{
          const onDemand = await getReport();
          if(onDemand){
            // keep the static narrative and signals from the generated JSON for stability
            // but prefer live `futures` and `metrics` if they exist to avoid stale futures readout
            if(onDemand.futures) report.futures = onDemand.futures;
            if(onDemand.metrics) report.metrics = onDemand.metrics;
            // ensure signals and priceSummary exist if generator didn't include them
            report.signals = report.signals || onDemand.signals || {};
            report.priceSummary = report.priceSummary || onDemand.priceSummary || '';
          }
        }catch(e){ /* ignore onDemand failure - use static latest */ }
      }else{
        report = await getReport();
      }
    }catch(e){
      console.warn('Failed to load latest JSON, falling back to getReport()', e && e.message);
      report = await getReport();
    }
    // Diagnostic logs: print whether SSR process sees Dune env and the fetched exchangeReserves
    try{
      console.log('SSR DUNE_API_KEY present?', !!process.env.DUNE_API_KEY);
      console.log('SSR DUNE_BINANCE_RESERVES_QUERY:', process.env.DUNE_BINANCE_RESERVES_QUERY || '<unset>');
      console.log('SSR exchangeReserves:', report && report.metrics && report.metrics.exchangeReserves);
    }catch(e){}
    // If the Next.js context has a res, set cache control headers so previews can be revalidated predictably.
    try{
      if(context && context.res && typeof context.res.setHeader === 'function'){
        if(isNaN(ttl) || ttl <= 0){
          context.res.setHeader('Cache-Control','no-store, must-revalidate');
        }else{
          context.res.setHeader('Cache-Control', `public, s-maxage=${ttl}, stale-while-revalidate=${Math.min(60, Math.floor(ttl/2))}`);
        }
      }
    }catch(e){ console.warn('Failed to set cache headers', e && e.message); }
    return { props: { payload: report } };
  }catch(e){
    console.warn('getServerSideProps failed:', e.message);
    return { props: { payload: null } };
  }
}

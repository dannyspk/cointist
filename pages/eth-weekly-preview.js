import React from 'react';
import dynamic from 'next/dynamic';
const EthWeeklyReport = dynamic(()=>import('../src/components/EthWeeklyReport'), { ssr:true });

export default function Preview({ payload }){
  // payload: { priceSummary, signals, futures, data }
  const fallback = { priceSummary: 'No data', signals: {}, futures: null, data: { snapshot:'', chronology:[], technicalReadout:[], levels:[], scenarios:[], checklist:[] } };
  const p = payload || fallback;
  return (
    <div style={{padding:2}}>
      <EthWeeklyReport priceSummary={p.priceSummary} signals={p.signals} futures={p.futures} data={p.data} metrics={p.metrics} />
    </div>
  );
}

// Server-side fetch to retrieve live payload from our API so the preview matches generator output
import { getReport } from '../lib/eth-weekly';

export async function getServerSideProps(){
  try{
    const report = await getReport();
    return { props: { payload: report } };
  }catch(e){
    console.warn('getServerSideProps failed:', e.message);
    return { props: { payload: null } };
  }
}

import React from 'react';
import dynamic from 'next/dynamic';
const BtcWeeklyReport = dynamic(()=>import('../src/components/BtcWeeklyReport'), { ssr:true });

export default function Preview({ payload }){
  const fallback = { priceSummary: 'No data', signals: {}, futures: null, data: { snapshot:'', chronology:[], technicalReadout:[], levels:[], scenarios:[], checklist:[] }, metrics: null };
  const p = payload || fallback;
  return (
    <div style={{padding:20}}>
      <BtcWeeklyReport priceSummary={p.priceSummary} signals={p.signals} futures={p.futures} data={p.data} metrics={p.metrics} />
    </div>
  );
}

import { getReport } from '../lib/sol-weekly';

export async function getServerSideProps(){
  try{
    const report = await getReport();
    return { props: { payload: report } };
  }catch(e){
    console.warn('getServerSideProps failed:', e.message);
    return { props: { payload: null } };
  }
}

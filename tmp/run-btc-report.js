const { getReport } = require('../lib/btc-weekly');
(async ()=>{
  try{
    const r = await getReport();
    console.log('report keys:', Object.keys(r));
    console.log('metrics:', r.metrics);
  }catch(e){ console.error('run failed', e && e.message); process.exit(1); }
})();

// override console.warn to ensure messages go to stdout with prefix
console.warn = (...args)=>{ console.log('[WARN]', ...args); };
(async()=>{
  try{
    const { getReport } = require('../lib/eth-weekly');
    const r = await getReport();
    console.log('\n==METRICS==\n', JSON.stringify(r.metrics, null, 2));
  }catch(e){ console.error('ERR', e); process.exit(1); }
})();

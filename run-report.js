(async ()=>{
  try{
    const path = require('path');
    const mod = require(path.join(process.cwd(),'lib','btc-weekly.js'));
    if(!mod || !mod.getReport) { console.error('getReport not found in module'); process.exit(2); }
    const r = await mod.getReport();
    console.log('REPORT-OK');
    console.log(JSON.stringify(Object.keys(r), null, 2));
  }catch(e){
    console.error('REPORT-ERROR', e && e.stack ? e.stack : e && e.message ? e.message : e);
    process.exit(3);
  }
})();
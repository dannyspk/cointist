const path = require('path');
const os = require('os');
const fs = require('fs');
(async ()=>{
  try{
    console.log('NODE ENV vars:');
    console.log('DUNE_API_KEY', !!process.env.DUNE_API_KEY);
    console.log('DUNE_BINANCE_RESERVES_QUERY', process.env.DUNE_BINANCE_RESERVES_QUERY || '<unset>');
    const { getReport } = require(path.join(__dirname,'..','lib','btc-weekly'));
    console.log('Calling getReport()...');
    const r = await getReport();
    console.log('getReport completed. metrics.exchangeReserves =', r && r.metrics && r.metrics.exchangeReserves);
    console.log('Full metrics:', r && r.metrics);
    const cacheFile = path.join(os.tmpdir(), 'exchange-reserves.json');
    console.log('os.tmpdir:', os.tmpdir());
    if(fs.existsSync(cacheFile)){
      console.log('Cache file exists at', cacheFile);
      console.log(fs.readFileSync(cacheFile,'utf8'));
    } else {
      console.log('Cache file not found at', cacheFile);
    }
  }catch(e){
    console.error('Error running debug script', e && e.message, e && e.stack);
    process.exit(1);
  }
})();

(async function(){
  try{
    console.log('NODE ENV vars:');
    console.log('DUNE_API_KEY', !!process.env.DUNE_API_KEY);
    console.log('CRYPTO_WEEKLY_TTL_SECONDS', process.env.CRYPTO_WEEKLY_TTL_SECONDS || '(unset)');
    console.log('Calling getReport()...');
    const rpt = await require('../lib/crypto-weekly').getReport();
    // Print concise preview
    console.log('\n=== SUMMARY ===');
    console.log(rpt.summary || '(no summary)');
    console.log('\n=== MOVERS ===');
    console.log('Up:', JSON.stringify(rpt.movers && rpt.movers.up || [], null, 2));
    console.log('Down:', JSON.stringify(rpt.movers && rpt.movers.down || [], null, 2));
    console.log('\n=== TOP 3 REPORTS (id, symbol, change) ===');
    (rpt.reports || []).slice(0,3).forEach(r => {
      const change = r && r.signals && typeof r.signals.change === 'number' ? r.signals.change.toFixed(2) : 'n/a';
      console.log(`${r.id} | ${r.symbol} | change: ${change}`);
    });
    console.log('\n=== EVENTS FOR TOP 3 ===');
    (rpt.reports || []).slice(0,3).forEach(r=>{
      console.log(`-- ${r.name} (${r.symbol}) events:`);
      if(r && r.data && Array.isArray(r.data.events) && r.data.events.length){
        r.data.events.forEach(e=> console.log(`  - ${e.publishedAt} | ${e.source} | ${e.title}`));
      }else{
        console.log('  (no events)');
      }
    });
    console.log('\nCache path check: tmp/crypto-weekly-cache.json');
    const fs = require('fs'); const path = require('path');
    const cp = path.join(__dirname,'..','tmp','crypto-weekly-cache.json');
    if(fs.existsSync(cp)) console.log('Cache exists at', cp, fs.statSync(cp).mtime.toISOString()); else console.log('Cache not found');
  }catch(e){ console.error('debug-crypto-weekly failed', e && (e.message || e)); process.exitCode = 2; }
})();

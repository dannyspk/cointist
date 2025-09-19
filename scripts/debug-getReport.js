const path = require('path');
const https = require('https');

(async ()=>{
  try{
  // Load local env file so SUPABASE_* env vars are available when running node directly
    try{
      require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
      console.log('Loaded .env.local');
    }catch(e){ console.log('dotenv not available or .env.local missing'); }

  console.log('News will be sourced from the local fetch-trending aggregator script (one item per coin, cached).');

    const { getReport } = require('../lib/crypto-weekly');
    // Ensure fresh generation when debugging
    process.env.CRYPTO_WEEKLY_TTL_SECONDS = '0';
    const report = await getReport();
    const diagnostics = { generatedAt: report.generatedAt, perCoin: [] };
    (report.reports || []).forEach(r=>{
      const cnt = (r && r.data && Array.isArray(r.data.events)) ? r.data.events.length : 0;
      const first = cnt ? r.data.events[0] : null;
      diagnostics.perCoin.push({ coin: r.id, name: r.name, events: cnt, first: first ? { title: first.title, url: first.url, source: first.source } : null });
    });
    console.log(JSON.stringify(diagnostics, null, 2));

    // Print any aggregator logs that may have been written during the run
    try{
      const fs = require('fs');
      const tmp = require('path').join(process.cwd(), 'tmp');
      if(fs.existsSync(tmp)){
        const files = fs.readdirSync(tmp).filter(n=>n.startsWith('trending') && (n.endsWith('.log') || n.endsWith('.json'))).slice(-5);
        if(files.length){
          console.log('\nAggregator debug files:');
          for(const f of files){
            try{ const p = require('path').join(tmp, f); const s = fs.readFileSync(p, 'utf8'); console.log(`--- ${f} ---\n${s.slice(0,400)}\n`); }catch(e){ /* ignore */ }
          }
        }
      }
    }catch(e){ /* ignore */ }
  }catch(e){
    console.error('ERROR', e && e.message);
    console.error(e && e.stack);
  }
})();

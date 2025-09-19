const { getJson } = (function(){
  const https = require('https');
  function getJson(url, options={}){
    return new Promise((resolve,reject)=>{
      let data='';
      https.get(url, options, (res)=>{
        res.on('data', c=>data+=c);
        res.on('end', ()=>{
          try{ if(res.statusCode>=200 && res.statusCode<300) return resolve(JSON.parse(data));
               return reject(new Error(`Fetch failed ${res.statusCode}`));
          }catch(e){ reject(e); }
        });
      }).on('error', reject);
    });
  }
  return { getJson };
})();

(async()=>{
  let metrics={gasGwei:null};
  try{
    console.log('-> try etherchain');
    try{
      const gasResp = await getJson('https://www.etherchain.org/api/gasprice');
      console.log('etherchain resp:', gasResp);
      if(gasResp && gasResp.standard){ metrics.gasGwei=Math.round(Number(gasResp.standard)); console.log('set from etherchain', metrics.gasGwei); }
      else{
        console.log('etherchain had no standard');
        await new Promise(r=>setTimeout(r,300));
        try{ const gasResp2 = await getJson('https://www.etherchain.org/api/gasprice'); console.log('etherchain retry', gasResp2); if(gasResp2 && gasResp2.standard){ metrics.gasGwei=Math.round(Number(gasResp2.standard)); console.log('set from etherchain retry', metrics.gasGwei);} }
        catch(e){ console.log('etherchain retry error', e.message); }

        if(metrics.gasGwei==null){
          try{
            const apiKey = process.env.ETHERSCAN_API_KEY ? `&apikey=${process.env.ETHERSCAN_API_KEY}` : '';
            const g2 = await getJson(`https://api.etherscan.io/api?module=gastracker&action=gasoracle${apiKey}`);
            console.log('etherscan raw:', g2);
            if(g2 && g2.result && g2.result.ProposeGasPrice){ metrics.gasGwei=Math.round(Number(g2.result.ProposeGasPrice)); console.log('set from etherscan', metrics.gasGwei); }
          }catch(e){ console.log('etherscan error', e.message); }
        }

        if(metrics.gasGwei==null){
          try{
            const g3 = await getJson('https://ethgas.watch/api/gas');
            console.log('ethgas.watch raw:', g3);
            if(g3 && (g3.standard || g3.average || g3.fast)){ const pick = g3.standard || g3.average || g3.fast; metrics.gasGwei = Math.round(Number(pick)); console.log('set from ethgas.watch', metrics.gasGwei); }
          }catch(e){ console.log('ethgas.watch error', e.message); }
        }
      }
    }catch(e){ console.log('primary etherchain fetch failed', e.message); }
  }catch(e){ console.log('outer err', e.message); }
  console.log('FINAL metrics', metrics);
})();

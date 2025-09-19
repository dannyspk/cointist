const https = require('https');
function getJson(url){
  return new Promise((resolve,reject)=>{
    https.get(url, { headers: { 'User-Agent':'node.js','Accept':'application/json' } }, res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{ const j = JSON.parse(d); resolve(j);}catch(e){ resolve({raw:d}); } });
    }).on('error', e=>reject(e));
  });
}
(async()=>{
  const apiKey = process.env.ETHERSCAN_API_KEY ? `&apikey=${process.env.ETHERSCAN_API_KEY}` : '';
  const probes = [
    {name:'etherchain gas', url:'https://www.etherchain.org/api/gasprice'},
    {name:'etherscan gasoracle', url:`https://api.etherscan.io/api?module=gastracker&action=gasoracle${apiKey}`},
    {name:'ethgas.watch', url:'https://ethgas.watch/api/gas'},
    {name:'beaconcha epoch summary', url:'https://beaconcha.in/api/v1/epoch/validators/summary'},
    {name:'beaconcha summary', url:'https://beaconcha.in/api/v1/summary'},
    {name:'etherscan validators', url:`https://api.etherscan.io/api?module=stats&action=validators${apiKey}`},
    {name:'defillama tvl ethereum', url:'https://api.llama.fi/tvl/ethereum'},
    {name:'defillama chains', url:'https://api.llama.fi/chains'}
  ];
  for(const p of probes){
    try{
      const r = await getJson(p.url);
      console.log('\n== ' + p.name + ' ==');
      if(typeof r === 'object'){
        // print small subset depending on endpoint
        if(p.name.includes('etherchain')) console.log('standard:', r.standard, 'fast:', r.fast, 'safeLow:', r.safeLow);
        else if(p.name.includes('gasoracle')) console.log('result keys:', r.result ? Object.keys(r.result) : Object.keys(r));
        else if(p.name.includes('ethgas.watch')) console.log('keys:', Object.keys(r));
        else if(p.name.includes('beaconcha')) console.log('has data:', !!r.data, Object.keys(r).slice(0,5));
        else if(p.name.includes('defillama') && p.url.endsWith('/ethereum')) console.log('tvl value type:', typeof r, r ? (r>0?'number>0':'falsy') : 'null');
        else if(p.name.includes('defillama') && p.url.endsWith('/chains')) console.log('chains length:', Array.isArray(r)?r.length:'not array');
        else console.log('raw keys:', Object.keys(r).slice(0,10));
      }else{
        console.log('raw response length:', String(r).length);
      }
    }catch(e){
      console.log('\n== ' + p.name + ' == FAILED ->', e.message);
    }
  }
})();

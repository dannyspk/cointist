const https = require('https');
function get(url){
  return new Promise((res,rej)=>{
    https.get(url,{headers:{'User-Agent':'node.js','Accept':'application/json'}},r=>{
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{ res(JSON.parse(d)); }catch(e){ res({raw:d}); } });
    }).on('error', rej);
  });
}
(async()=>{
  const apiKey = process.env.ETHERSCAN_API_KEY ? `&apikey=${process.env.ETHERSCAN_API_KEY}` : '';
  try{
    const es = await get(`https://api.etherscan.io/api?module=stats&action=validators${apiKey}`);
    console.log('==etherscan validators=='); console.log(JSON.stringify(es, null, 2).slice(0,4000));
    const dl = await get('https://api.llama.fi/chains');
    const eth = Array.isArray(dl)? dl.find(c=>c.chain && c.chain.toLowerCase()==='ethereum') : null;
    console.log('\n==defillama ethereum chain entry=='); console.log(JSON.stringify(eth, null, 2).slice(0,4000));
  }catch(e){ console.error('err', e); }
})();

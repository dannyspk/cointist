const https = require('https');
function get(url){
  return new Promise((res,rej)=>{
    https.get(url,{headers:{'User-Agent':'node.js','Accept':'application/json'}},r=>{
      let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{ res(JSON.parse(d)); }catch(e){ res({raw:d}); } });
    }).on('error', rej);
  });
}
(async()=>{
  try{
    const apiKey = process.env.ETHERSCAN_API_KEY ? `&apikey=${process.env.ETHERSCAN_API_KEY}` : '';
    const url = `https://api.etherscan.io/api?module=gastracker&action=gasoracle${apiKey}`;
    const r = await get(url);
    console.log('==full response==');
    console.log(JSON.stringify(r, null, 2));
    console.log('\n==ProposeGasPrice==');
    console.log(r && r.result && r.result.ProposeGasPrice, typeof (r && r.result && r.result.ProposeGasPrice));
  }catch(e){ console.error('err', e); process.exit(1); }
})();

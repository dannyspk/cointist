const https = require('https');

function getJson(url){
  return new Promise((resolve,reject)=>{
    let data='';
    https.get(url, { headers:{ 'User-Agent':'node.js' } }, (res)=>{
      res.on('data', c=>data+=c);
      res.on('end', ()=>{
        try{ const parsed = JSON.parse(data); return resolve({status: res.statusCode, body: parsed}); }catch(e){ return resolve({status: res.statusCode, body: data}); }
      });
    }).on('error', (e)=> reject(e));
  });
}

(async ()=>{
  const key = process.env.BEACONCHA_API_KEY;
  if(!key){
    console.error('NO_KEY');
    process.exit(2);
  }
  const url = `https://beaconcha.in/api/v1/slot/1?apikey=${encodeURIComponent(key)}`;
  console.log('PROBE_URL:', url.replace(/(apikey=).+/,'$1<REDACTED>'));
  try{
    const r = await getJson(url);
    console.log('STATUS:', r.status);
    if(typeof r.body === 'object'){
      console.log('BODY KEYS:', Object.keys(r.body).slice(0,20));
      // print small sample without sensitive info
      const sample = {};
      let cnt = 0;
      for(const k of Object.keys(r.body)){
        if(cnt++>10) break;
        const v = r.body[k];
        if(typeof v === 'object') sample[k] = Array.isArray(v) ? `ARRAY[len=${v.length}]` : `OBJECT[${Object.keys(v).slice(0,6).join(',')}]`;
        else sample[k] = v;
      }
      console.log('SAMPLE:', sample);
    } else {
      console.log('BODY (truncated):', String(r.body).slice(0,1000));
    }
  }catch(e){
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

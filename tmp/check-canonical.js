const fetch = require('node-fetch');
(async ()=>{
  const url = 'https://cointist.net/news/articles/caution-advised-amidst-cryptocurrency-market-losses';
  try{
    const r = await fetch(url);
    const t = await r.text();
    console.log('--- canonical ---');
    (t.match(/<link[^>]*rel=["']canonical["'][^>]*>/gi)||[]).forEach(c=>console.log(c));
    console.log('\n--- robots ---');
    (t.match(/<meta[^>]*name=["']robots["'][^>]*>/gi)||[]).forEach(c=>console.log(c));
    console.log('\n--- jsonld ---');
    (t.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[]).forEach(c=>console.log(c.slice(0,400)+'...'));
  }catch(e){ console.error(e && e.message || e) }
})();
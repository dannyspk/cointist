const { Storage } = require('@google-cloud/storage');
const fetch = require('node-fetch');
(async()=>{
  try {
    const storage = new Storage();
    const bucket = storage.bucket('cointist-images');
    const [files] = await bucket.getFiles({ prefix: 'uploads/' });
    if (!files.length) { console.log('no files found'); return; }
    console.log('checking', files.length, 'files');
    for (const f of files) {
      const publicUrl = `https://storage.googleapis.com/cointist-images/${encodeURIComponent(f.name)}`;
      try {
        const r = await fetch(publicUrl, { method: 'HEAD' });
        console.log(f.name, '->', r.status);
      } catch (e) {
        console.log(f.name, '-> fetch error', e.message);
      }
    }
  } catch (e) { console.error('err', e && e.message ? e.message : e); process.exit(1); }
})();

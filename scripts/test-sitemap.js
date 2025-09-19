(async ()=>{
  const { getServerSideProps } = require('../pages/sitemap.xml.js');
  // Create a fake res object that captures written data
  let body = '';
  const res = {
    headers: {},
    setHeader(k,v){ this.headers[k]=v },
    write(s){ body += s },
    end(){ /* noop */ }
  };
  await getServerSideProps({ res });
  if (body.indexOf('/news') !== -1 || body.indexOf('/reviews') !== -1) {
    console.error('BAD: sitemap contains /news or /reviews');
    process.exit(2);
  }
  console.log('OK: sitemap does not contain /news or /reviews');
})();

// Script to call the API handler directly and print the JSON response
const handler = require('../pages/api/articles/index.js').default;

const req = {
  method: 'GET',
  query: { category: 'News', subcategory: 'latest', pinned: 'false', page: '1', pageSize: '8' },
  headers: {},
};

const res = {
  statusCode: 200,
  headers: {},
  setHeader(name, value){ this.headers[name] = value },
  json(data){
    console.log('API JSON response:\n', JSON.stringify(data, null, 2));
    process.exit(0);
  },
  status(code){ this.statusCode = code; return this },
  end(msg){ if (msg) console.log(msg); process.exit(0); }
};

handler(req, res).catch(e=>{ console.error('handler error', e); process.exit(1); });

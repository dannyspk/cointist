const { getReport } = require('../../lib/eth-weekly');

export default async function handler(req, res){
  try{
    const report = await getReport();
    const metrics = report && report.metrics ? report.metrics : null;
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ metrics });
  }catch(e){
    console.warn('metrics api failed', e && e.message);
    return res.status(500).json({ error: 'failed' });
  }
}

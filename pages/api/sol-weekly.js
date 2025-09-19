const { getReport } = require('../../lib/sol-weekly');

export default async function handler(req, res){
  try{
    const report = await getReport();
    return res.status(200).json(report);
  }catch(err){
    console.error('API error', err && err.message);
    return res.status(500).json({ error: err.message || 'unknown' });
  }
}

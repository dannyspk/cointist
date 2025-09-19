import { getReport } from '../../lib/crypto-weekly';

export default async function handler(req, res){
  try{
    const report = await getReport();
    res.status(200).json(report);
  }catch(e){
    res.status(500).json({ error: e && e.message ? e.message : 'report error' });
  }
}

import getSupabaseServer from '../../../../src/lib/supabaseServer';
import { requireAdmin } from '../../../../src/lib/auth';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const supabase = getSupabaseServer();

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('articles').select('*').order('createdAt', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    const payload = req.body;
    const { data, error } = await supabase.from('articles').insert(payload).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data && data[0] ? data[0] : data);
  }

  res.setHeader('Allow', ['GET','POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

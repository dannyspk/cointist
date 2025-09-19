import getSupabaseServer from '../../../../src/lib/supabaseServer';
import { requireAdmin } from '../../../../src/lib/auth';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  const supabase = getSupabaseServer();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('articles').select('*').eq('id', Number(id)).limit(1).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'PUT') {
    const payload = req.body;
    // Ensure we update by numeric id
    const { data, error } = await supabase.from('articles').update(payload).eq('id', Number(id)).select();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data && data[0] ? data[0] : data);
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('articles').delete().eq('id', Number(id));
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', ['GET','PUT','DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}

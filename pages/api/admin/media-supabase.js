import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../src/lib/auth'

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  // support optional prefix inside a bucket: e.g. bucket=images&prefix=thumbnails
  const bucket = String(req.query.bucket || 'thumbnails');
  const prefix = typeof req.query.prefix !== 'undefined' ? String(req.query.prefix || '') : '';
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(501).json({ error: 'Supabase not configured' });

  const supa = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  try {
    const listPath = prefix || '';
    const { data, error } = await supa.storage.from(bucket).list(listPath, { limit: 1000, offset: 0, sortBy: { column: 'name', order: 'desc' } });
    if (error) return res.status(500).json({ error: error.message || String(error) });
    const dataArr = data || [];

    const normalizeUrl = (u) => {
      if (!u) return null;
      try {
        u = String(u);
        if (u.startsWith('//')) return 'https:' + u;
        if (/^https?:\/\//i.test(u)) return u;
        if (u.startsWith('/')) {
          try { const base = new URL(supabaseUrl); return base.origin + u; } catch(e) { return 'https://' + u.replace(/^\/+/, ''); }
        }
        return 'https://' + u;
      } catch (e) { return null; }
    };

    const items = [];
    for (const obj of dataArr) {
      const cleanedPrefix = listPath ? String(listPath).replace(/^\/+|\/+$/g, '') : '';
      const objectPath = cleanedPrefix ? `${cleanedPrefix}/${obj.name}` : obj.name;

      // try public URL
      let publicUrl = null;
      try {
        const pubRes = supa.storage.from(bucket).getPublicUrl(objectPath);
        if (pubRes) {
          publicUrl = (pubRes.data && (pubRes.data.publicUrl || pubRes.data.publicURL)) || pubRes.publicURL || pubRes.publicUrl || null;
        }
      } catch (e) {
        publicUrl = null;
      }

      let finalUrl = normalizeUrl(publicUrl);

      // if we don't have a usable public URL and we have a service role key, try a signed URL
      if (!finalUrl && process.env.SUPABASE_SERVICE_ROLE_KEY && typeof supa.storage.from(bucket).createSignedUrl === 'function') {
        try {
          const signedRes = await supa.storage.from(bucket).createSignedUrl(objectPath, 60 * 60);
          if (signedRes) {
            finalUrl = signedRes.signedURL || (signedRes.data && (signedRes.data.signedUrl || signedRes.data.signedURL)) || finalUrl;
          }
        } catch (e) {
          // ignore signing errors
        }
      }

      items.push({ name: obj.name, path: objectPath, url: finalUrl || publicUrl || null, updated_at: obj.updated_at || obj.last_modified || null, size: (obj.metadata && obj.metadata.size) || null });
    }

    return res.json({ data: items });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}

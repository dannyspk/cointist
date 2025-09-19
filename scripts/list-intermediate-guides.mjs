import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadVercelEnv(filePath) {
  try {
    const txt = fs.readFileSync(filePath, 'utf8');
    const lines = txt.split(/\r?\n/);
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      // strip surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (key && typeof process.env[key] === 'undefined') process.env[key] = val;
    }
  } catch (e) {
    // ignore
  }
}

function tagIncludes(raw, tagName) {
  if (!raw || !tagName) return false;
  const target = String(tagName).trim().toLowerCase();
  try {
    if (Array.isArray(raw)) return raw.map(t => String(t||'').trim().toLowerCase()).includes(target);
    if (typeof raw === 'string') {
      // try JSON parse (some exports store JSON string)
      const trimmed = raw.trim();
      if ((trimmed.startsWith('[') || trimmed.startsWith('{')) && (trimmed.endsWith(']') || trimmed.endsWith('}'))) {
        try { const parsed = JSON.parse(trimmed); return tagIncludes(parsed, tagName); } catch(e) {}
      }
      return trimmed.split(',').map(t => t.trim().toLowerCase()).includes(target);
    }
    // other types
    return String(raw).trim().toLowerCase() === target;
  } catch (e) { return false; }
}

async function main() {
  // load .vercel.env if present so local dev can reuse Vercel creds
  const vercelEnv = path.resolve(process.cwd(), '.vercel.env');
  if (fs.existsSync(vercelEnv)) loadVercelEnv(vercelEnv);

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment.');
    console.error('Set them in your environment or in .vercel.env');
    process.exit(2);
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

  try {
    const limit = 1000;
    const res = await supa.from('Guides').select('*').limit(limit);
    if (res.error) {
      console.error('Supabase query error:', res.error.message || res.error);
      process.exit(3);
    }
    const rows = res.data || [];
  const tag = (process.argv && process.argv[2]) ? String(process.argv[2]) : 'Intermediate';
  const matches = rows.filter(r => tagIncludes(r.tags || r.tags_list || r.tag || r.labels || r.categories || r.tagsString, tag));
  console.log(`Found ${matches.length} guide(s) with '${tag}' tag (queried ${rows.length} rows):`);
    for (const a of matches) {
      const tagsVal = Array.isArray(a.tags) ? a.tags.join(', ') : (typeof a.tags === 'string' ? a.tags : JSON.stringify(a.tags));
      console.log('-', a.id || '', '-', a.title || a.name || a.slug || '(no title)', '-', a.slug || '', '-', tagsVal || '');
    }
  } catch (e) {
    console.error('Error connecting to Supabase or processing rows:', e && e.message ? e.message : e);
    process.exit(4);
  }
}

main();

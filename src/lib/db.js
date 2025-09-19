// Lazy-import Prisma to avoid module evaluation errors in serverless when Prisma client/binary is missing.
let prisma = null;
try {
  // use require for lazy load so top-level import failures don't crash module evaluation
  // eslint-disable-next-line global-require
  prisma = require('./prisma').default || require('./prisma');
} catch (e) {
  // swallow — we'll prefer Supabase below when Prisma isn't available
  prisma = null;
}
const { createClient } = require('@supabase/supabase-js');

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const FORCE_SUPABASE = (process.env.FORCE_SUPABASE || '').toLowerCase() === '1' || (process.env.FORCE_SUPABASE || '').toLowerCase() === 'true';

let supa = null;
if (SUPA_URL && SUPA_KEY) {
  supa = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } });
}

// cache Prisma probe results for a short TTL to avoid probing on every request
let _prismaProbe = { ok: null, ts: 0 };
const PRISMA_PROBE_TTL = 30 * 1000; // 30s

async function isPrismaReachable(timeoutMs = 2000) {
  if (FORCE_SUPABASE) return false;
  // don't gate Prisma probe strictly on DATABASE_URL — in local dev Prisma client may be usable
  // even if env var is not present (e.g. sqlite datasource with embedded path). If Prisma isn't
  // available at all, bail out.
  if (!prisma) return false;
  const now = Date.now();
  if (_prismaProbe.ok !== null && (now - _prismaProbe.ts) < PRISMA_PROBE_TTL) return _prismaProbe.ok;

  // try a lightweight query with a timeout
  const probe = prisma.$queryRaw`SELECT 1`;
  const timer = new Promise((_, reject) => setTimeout(() => reject(new Error('prisma probe timeout')), timeoutMs));
  try {
    await Promise.race([probe, timer]);
    _prismaProbe = { ok: true, ts: Date.now() };
    return true;
  } catch (e) {
    _prismaProbe = { ok: false, ts: Date.now() };
    return false;
  }
}

async function canUsePrisma() {
  // prefer Prisma only when DATABASE_URL is set and a quick probe succeeds
  return await isPrismaReachable();
}

function supaTableForCategory(category){
  if (!category) return 'Article';
  if (String(category).toLowerCase() === 'guides' || String(category) === 'Guides') return 'Guides';
  return 'Article';
}

export async function findArticles(opts = {}) {
  const where = opts.where || {};
  const sort = opts.sort || 'recent'
  const forceSupabase = !!opts.forceSupabase;
  // new opt-in flag: includeGuides when true will allow fetching the Guides table
  const includeGuides = !!opts.includeGuides;
  // If neither Supabase nor Prisma clients are available, return an empty list instead of throwing
  if (!supa && !prisma) return [];
  // Enforce: unless explicitly asked for category 'Opinions' or includeOpinions is true, exclude Opinions from general lists
  const explicitCategory = typeof where.category !== 'undefined' && where.category !== null;
  const includeOpinions = !!opts.includeOpinions;

  if (supa && (forceSupabase || !(await canUsePrisma()))) {
    // Supabase branch: apply category filter when provided, otherwise exclude 'Opinions' unless includeOpinions is true
    // sort: recent -> publishedAt desc, oldest -> publishedAt asc
    const asc = sort === 'oldest';

    // builder applies common filters to a table query
    const buildQuery = (tbl) => {
      // Order by publishedAt, then updatedAt, then createdAt so DB-level ordering matches server in-memory sort
      let q = supa.from(tbl).select('*').order('publishedAt', { ascending: asc }).order('updatedAt', { ascending: asc }).order('createdAt', { ascending: asc });
      if (typeof opts.take !== 'undefined') q = q.limit(opts.take || 50);
      if (typeof opts.skip !== 'undefined' && Number.isFinite(Number(opts.skip)) && Number(opts.skip) >= 0) {
        // Supabase supports .range(start, end) for offset pagination; compute end as start + take - 1 when take present
        const start = Number(opts.skip) || 0;
        const end = (typeof opts.take !== 'undefined') ? (start + Number(opts.take) - 1) : undefined;
        try { if (typeof end !== 'undefined') q = q.range(start, end); else q = q.range(start, start + 9999); } catch (e) { /* ignore if range not supported */ }
      }
      if (explicitCategory) q = q.eq('category', where.category);
      else if (!includeOpinions) q = q.not('category', 'eq', 'Opinions');
      if (typeof where.featuredOnly !== 'undefined') {
        const v = where.featuredOnly;
        if (v === true || String(v) === '1' || String(v).toLowerCase() === 'true') q = q.eq('featuredOnly', true);
        else if (v === false || String(v) === '0' || String(v).toLowerCase() === 'false') q = q.eq('featuredOnly', false);
      }
      if (typeof where.published !== 'undefined') {
        const val = where.published;
        if (val === true || String(val).toLowerCase() === 'true' || String(val) === '1') q = q.eq('published', true);
        else if (val === false || String(val).toLowerCase() === 'false' || String(val) === '0') q = q.eq('published', false);
      }
      return q;
    };

    // If category explicitly set, query only that mapped table
    if (explicitCategory) {
      const table = supaTableForCategory(where.category);
      let query = buildQuery(table);
      if (where.excludeIds && Array.isArray(where.excludeIds) && where.excludeIds.length) {
        try { query = query.not('id','in', `(${where.excludeIds.join(',')})`); } catch(e) { /* fallback */ }
      }
      const { data, error } = await query;
      if (error) throw error;
      if (opts && opts._debug) console.debug('[db.findArticles] using Supabase branch (supa)', { forceSupabase, table });
      if (where.excludeIds && Array.isArray(where.excludeIds) && where.excludeIds.length) return (data || []).filter(d => !where.excludeIds.includes(d.id));
      return data;
    }

    // No explicit category: by default do NOT include Guides table unless includeGuides is true.
    const take = opts.take || 50;
  if (!includeGuides) {
      // Query only Article table
      let query = buildQuery('Article');
      if (where.excludeIds && Array.isArray(where.excludeIds) && where.excludeIds.length) {
        try { query = query.not('id','in', `(${where.excludeIds.join(',')})`); } catch(e) { /* fallback */ }
      }
      const { data, error } = await query;
      if (error) throw error;
  if (opts && opts._debug) console.debug('[db.findArticles] using Supabase branch (Article only, Guides excluded)', { forceSupabase });
  if (where.excludeIds && Array.isArray(where.excludeIds) && where.excludeIds.length) return (data || []).filter(d => !where.excludeIds.includes(d.id));
  return (data || []).slice(0, take);
    }

    // includeGuides true: fetch from both Article and Guides and merge so Guides appear in listings
  const perTable = Math.max(50, take * 2);
  const [aRes, gRes] = await Promise.all([ buildQuery('Article').limit(perTable), buildQuery('Guides').limit(perTable) ]);
    if ((aRes && aRes.error) || (gRes && gRes.error)) {
      const err = (aRes && aRes.error) || (gRes && gRes.error);
      throw err;
    }
    const aData = (aRes && aRes.data) || [];
    const gData = (gRes && gRes.data) || [];
    const merged = [...aData, ...gData].sort((x,y)=>{
      const dx = x && (x.publishedAt || x.updatedAt || x.createdAt) ? new Date(x.publishedAt || x.updatedAt || x.createdAt).getTime() : 0;
      const dy = y && (y.publishedAt || y.updatedAt || y.createdAt) ? new Date(y.publishedAt || y.updatedAt || y.createdAt).getTime() : 0;
      return asc ? dx - dy : dy - dx;
    });
    const filtered = (where.excludeIds && Array.isArray(where.excludeIds) && where.excludeIds.length) ? merged.filter(d => !where.excludeIds.includes(d.id)) : merged;
    if (opts && opts._debug) console.debug('[db.findArticles] using Supabase branch (merged Article+Guides)', { forceSupabase });
    // Apply skip/take on merged result when present
    const startIdx = (typeof opts.skip !== 'undefined' && Number.isFinite(Number(opts.skip))) ? Number(opts.skip) : 0;
    return filtered.slice(startIdx, startIdx + take);
  }

  // Prisma branch: if no explicit category filter and includeOpinions is false, add a NOT condition for Opinions
  // Note: Prisma branch currently stores Guides in same table; includeGuides has no effect here.
  const prismaWhere = explicitCategory || includeOpinions ? where : { ...where, category: { not: 'Opinions' } };
  // translate excludeIds into Prisma notIn clause
  if (prismaWhere.excludeIds && Array.isArray(prismaWhere.excludeIds) && prismaWhere.excludeIds.length){
    prismaWhere.id = { notIn: prismaWhere.excludeIds }
    delete prismaWhere.excludeIds
  }
  const orderDir = sort === 'oldest' ? 'asc' : 'desc'
  // Order by publishedAt, then updatedAt, then createdAt to make ordering deterministic when publishedAt is null
  // Prisma supports skip/take directly
  const qopts = { where: prismaWhere, orderBy: [{ publishedAt: orderDir }, { updatedAt: orderDir }, { createdAt: orderDir }], take: opts.take || 50 };
  if (typeof opts.skip !== 'undefined' && Number.isFinite(Number(opts.skip))) qopts.skip = Number(opts.skip);
  return prisma.article.findMany(qopts);
}

// Helper: convert Date objects and boolean-like values to Supabase-friendly primitives
function sanitizeForSupabase(obj = {}) {
  const out = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'undefined') continue; // don't send undefined (Supabase may overwrite with null)
    // Normalize booleans for common flags
    if (k === 'published' || k === 'pinned' || k === 'featuredOnly') {
      out[k] = !!v;
      continue;
    }
    // dates -> ISO strings
    if (k === 'publishedAt' || k === 'scheduledAt' || k === 'pinnedAt' || k === 'createdAt' || k === 'updatedAt') {
      if (v === null) { out[k] = null; continue; }
      try {
        if (v instanceof Date) out[k] = v.toISOString();
        else if (typeof v === 'string' && v) out[k] = (new Date(v)).toISOString();
        else out[k] = v;
      } catch (e) { out[k] = v; }
      continue;
    }
    // For arrays (tags) and primitives, pass through
    out[k] = v;
  }
  return out;
}

// Trim image URL fields (coverImage, thumbnail) after the first occurrence of
// a common image extension (png, webp, jpg, jpeg, gif, avif). Returns the
// substring up to and including the extension if found, otherwise returns
// the original string unchanged.
function trimImageUrl(s) {
  if (!s || typeof s !== 'string') return s;
  // match up to the first occurrence of one of the extensions (case-insensitive)
  const m = s.match(/^(.*?\.(?:png|webp|jpg|jpeg|gif|avif))/i);
  if (m && m[1]) return m[1];
  return s;
}

// Normalize and trim image-related fields on an object, case-insensitive keys.
function trimImageFields(obj = {}) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    const k = String(key || '').toLowerCase();
    if (k === 'coverimage' || k === 'thumbnail') {
      try {
  obj[key] = trimImageUrl(obj[key]);
      } catch (e) { /* ignore */ }
    }
  }
  return obj;
}

// note: countArticles already repeats logic; add debug there as well

export async function findArticleBySlug(slug) {
  // If no DB clients are configured, return null rather than throwing
  if (!supa && !prisma) return null;
  if (supa && !(await canUsePrisma())) {
  // Try primary Article table first, then Guides if not found
  let res = await supa.from('Article').select('*').eq('slug', slug).limit(1);
  if (res.error) throw res.error;
  if (res.data && res.data[0]) return res.data[0];
  // try Guides table
  res = await supa.from('Guides').select('*').eq('slug', slug).limit(1);
  if (res.error) throw res.error;
  return res.data && res.data[0] ? res.data[0] : null;
  }
  return prisma.article.findUnique({ where: { slug } });
}

export async function findArticleById(id) {
  if (!supa && !prisma) return null;
  if (supa && !(await canUsePrisma())) {
  let res = await supa.from('Article').select('*').eq('id', Number(id)).limit(1);
  if (res.error) throw res.error;
  if (res.data && res.data[0]) return res.data[0];
  res = await supa.from('Guides').select('*').eq('id', Number(id)).limit(1);
  if (res.error) throw res.error;
  return res.data && res.data[0] ? res.data[0] : null;
  }
  return prisma.article.findUnique({ where: { id: Number(id) } });
}

export async function countArticles(where = {}, opts = {}) {
  const explicitCategory = typeof where.category !== 'undefined' && where.category !== null;
  const includeOpinions = !!opts.includeOpinions;
  const includeGuides = !!opts.includeGuides;
  if (!supa && !prisma) return 0;
  if (supa && !(await canUsePrisma())) {
  // If category provided, count only that table; otherwise count both Article and Guides and sum
  if (explicitCategory) {
    const table = supaTableForCategory(where.category);
    let query = supa.from(table).select('id', { count: 'exact', head: true }).eq('category', where.category);
    if (typeof where.featuredOnly !== 'undefined') {
      const v = where.featuredOnly;
      if (v === true || String(v) === '1' || String(v).toLowerCase() === 'true') query = query.eq('featuredOnly', true);
      else if (v === false || String(v) === '0' || String(v).toLowerCase() === 'false') query = query.eq('featuredOnly', false);
    }
    if (typeof where.published !== 'undefined') {
      const val = where.published;
      if (val === true || String(val).toLowerCase() === 'true' || String(val) === '1') query = query.eq('published', true);
      else if (val === false || String(val).toLowerCase() === 'false' || String(val) === '0') query = query.eq('published', false);
    }
    const { count, error } = await query;
    if (error) throw error;
    if (opts && opts._debug) console.debug('[db.countArticles] using Supabase branch (supa)', { table });
    return count || 0;
  }

  // No explicit category: query Article table and optionally Guides when includeGuides is true
  const q1 = supa.from('Article').select('id', { count: 'exact', head: true });
  if (!includeGuides) {
    if (!includeOpinions) q1.not('category', 'eq', 'Opinions');
    if (typeof where.featuredOnly !== 'undefined') {
      const v = where.featuredOnly;
      if (v === true || String(v) === '1' || String(v).toLowerCase() === 'true') { q1.eq('featuredOnly', true); }
      else if (v === false || String(v) === '0' || String(v).toLowerCase() === 'false') { q1.eq('featuredOnly', false); }
    }
    if (typeof where.published !== 'undefined') {
      const val = where.published;
      if (val === true || String(val).toLowerCase() === 'true' || String(val) === '1') { q1.eq('published', true); }
      else if (val === false || String(val).toLowerCase() === 'false' || String(val) === '0') { q1.eq('published', false); }
    }
    const r1 = await q1;
    if (r1 && r1.error) throw r1.error;
    const c1 = (r1 && r1.count) || 0;
    if (opts && opts._debug) console.debug('[db.countArticles] using Supabase branch (Article only, Guides excluded)', { c1 });
    return c1;
  }

  // includeGuides true: query both tables and sum counts
  const q2 = supa.from('Guides').select('id', { count: 'exact', head: true });
  if (!includeOpinions) q1.not('category', 'eq', 'Opinions');
  if (typeof where.featuredOnly !== 'undefined') {
    const v = where.featuredOnly;
    if (v === true || String(v) === '1' || String(v).toLowerCase() === 'true') { q1.eq('featuredOnly', true); q2.eq('featuredOnly', true); }
    else if (v === false || String(v) === '0' || String(v).toLowerCase() === 'false') { q1.eq('featuredOnly', false); q2.eq('featuredOnly', false); }
  }
  if (typeof where.published !== 'undefined') {
    const val = where.published;
    if (val === true || String(val).toLowerCase() === 'true' || String(val) === '1') { q1.eq('published', true); q2.eq('published', true); }
    else if (val === false || String(val).toLowerCase() === 'false' || String(val) === '0') { q1.eq('published', false); q2.eq('published', false); }
  }
  const [r1, r2] = await Promise.all([q1, q2]);
  if ((r1 && r1.error) || (r2 && r2.error)) {
    const err = (r1 && r1.error) || (r2 && r2.error);
    throw err;
  }
  const c1 = (r1 && r1.count) || 0;
  const c2 = (r2 && r2.count) || 0;
  if (opts && opts._debug) console.debug('[db.countArticles] using Supabase branch (supa) Article+Guides', { c1, c2 });
  return (c1 || 0) + (c2 || 0);
  }

  const prismaWhere = explicitCategory || includeOpinions ? where : { ...where, category: { not: 'Opinions' } };
  return prisma.article.count({ where: prismaWhere });
}

export async function createArticle(data) {
  // Ensure image fields are normalized before storing
  trimImageFields(data);
  if (supa && !(await canUsePrisma())) {
  const table = supaTableForCategory(data && data.category);
  const payload = sanitizeForSupabase(data || {});
  trimImageFields(payload);
  const { data: inserted, error } = await supa.from(table).insert([payload]).select();
    if (error) throw error;
    return inserted && inserted[0] ? inserted[0] : null;
  }
  return prisma.article.create({ data });
}

export async function createArticleVersion(data) {
  if (supa && !(await canUsePrisma())) {
    const { data: inserted, error } = await supa.from('ArticleVersion').insert([data]).select();
    if (error) throw error;
    return inserted && inserted[0] ? inserted[0] : null;
  }
  return prisma.articleVersion.create({ data });
}

export async function updateArticle(id, data) {
  // Ensure image fields are normalized before updating
  trimImageFields(data);
  if (supa && !(await canUsePrisma())) {
    // Decide table: prefer explicit category in payload, otherwise try Article then Guides
    const tableFromPayload = data && data.category ? supaTableForCategory(data.category) : null;
    if (tableFromPayload) {
      const payload = sanitizeForSupabase(data || {});
      trimImageFields(payload);
      const { data: updated, error } = await supa.from(tableFromPayload).update(payload).eq('id', Number(id)).select();
      if (error) throw error;
      return updated && updated[0] ? updated[0] : null;
    }
    // No category provided: try Article first, then Guides
    let res = await supa.from('Article').update(sanitizeForSupabase(trimImageFields(data || {}))).eq('id', Number(id)).select();
    if (res.error) throw res.error;
    if (res.data && res.data[0]) return res.data[0];
    res = await supa.from('Guides').update(sanitizeForSupabase(trimImageFields(data || {}))).eq('id', Number(id)).select();
    if (res.error) throw res.error;
    return res.data && res.data[0] ? res.data[0] : null;
  }
  return prisma.article.update({ where: { id: Number(id) }, data });
}

export async function deleteArticle(id) {
  if (supa && !(await canUsePrisma())) {
  // Try deleting from Article first; if not present, try Guides
  let res = await supa.from('Article').delete().eq('id', Number(id)).select();
  if (res.error) throw res.error;
  if (res.data && res.data.length) return true;
  res = await supa.from('Guides').delete().eq('id', Number(id)).select();
  if (res.error) throw res.error;
  return true;
  }
  await prisma.article.delete({ where: { id: Number(id) } });
  return true;
}

export default {
  findArticles,
  findArticleBySlug,
  findArticleById,
  countArticles,
  createArticle,
  createArticleVersion,
  updateArticle,
  deleteArticle,
};

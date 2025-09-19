// pages API proxy for CoinGecko (clean, single implementation)
import type { NextApiRequest, NextApiResponse } from 'next';

type CacheEntry = {
  ts: number;
  data: any;
};

// Keep cached responses for 90s to align with client polling and reduce CoinGecko rate-limit hits
const CACHE_TTL_MS = 90 * 1000; // 90s
const cache = new Map<string, CacheEntry>();

function isSafePath(path: string) {
  if (/https?:\/\//i.test(path)) return false;
  if (path.includes('..')) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS for local dev (page may be served on another dev port)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const urlParam = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!urlParam || typeof urlParam !== 'string') {
    return res.status(400).json({ error: 'Missing required `url` query parameter' });
  }

  if (!isSafePath(urlParam)) {
    return res.status(400).json({ error: 'Invalid `url` parameter' });
  }

  const cacheKey = urlParam;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached.data);
  }

  const target = `https://api.coingecko.com/api/v3/${urlParam}`;

  try {
    const r = await fetch(target, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Cointist-Proxy/1.0 (+https://cointist.com)'
      },
    });

    const contentType = r.headers.get('content-type') || '';
    const text = await r.text();

    let data: any = null;
    if (contentType.includes('application/json')) {
      try { data = JSON.parse(text); } catch (err) { data = text; }
    } else {
      data = text;
    }

    if (r.ok) {
      cache.set(cacheKey, { ts: now, data });
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(data);
    }

    return res.status(r.status).json({ error: data ?? 'Upstream error' });
  } catch (err: any) {
    console.error('coingecko proxy error', err && err.message ? err.message : err);
    return res.status(502).json({ error: 'Failed to fetch upstream' });
  }
}

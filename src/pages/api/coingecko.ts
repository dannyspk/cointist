console.log('loading /api/coingecko');

import type { NextApiRequest, NextApiResponse } from 'next';

type CacheEntry = {
  ts: number;
  data: any;
};

const CACHE_TTL_MS = 60 * 1000; // 60s
const cache = new Map<string, CacheEntry>();

function isSafePath(path: string) {
  // Basic safety: disallow protocol, absolute URLs, and traversal
  if (/https?:\/\//i.test(path)) return false;
  if (path.includes('..')) return false;
  return true;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow cross-origin during local development (page may be served on a different dev port)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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
        // Minimal UA to avoid some remote blocks
        'User-Agent': 'Cointist-Proxy/1.0 (+https://cointist.com)'
      },
    });

    const contentType = r.headers.get('content-type') || '';
    const text = await r.text();

    // Try to parse JSON when appropriate
    let data: any = null;
    if (contentType.includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        // fallthrough to send raw text
        data = text;
      }
    } else {
      data = text;
    }

    // Cache only successful JSON responses
    if (r.ok) {
      cache.set(cacheKey, { ts: now, data });
      res.setHeader('X-Cache', 'MISS');
      return res.status(200).json(data);
    }

    // Proxy error status and body
    res.status(r.status).json({ error: data ?? 'Upstream error' });
  } catch (err: any) {
    console.error('coingecko proxy error', err && err.message ? err.message : err);
    res.status(502).json({ error: 'Failed to fetch upstream' });
  }
}

// file touched to trigger Turbopack

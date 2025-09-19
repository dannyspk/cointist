import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

// Helper to scan public/pages and produce clean routes to HTML files.
function collectStaticPageRewrites(): Array<{ source: string; destination: string }> {
  const pagesDir = path.join(process.cwd(), 'public', 'pages');
  const rewrites: Array<{ source: string; destination: string }> = [];
  if (!fs.existsSync(pagesDir)) return rewrites;

  function walk(dir: string, base = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory()) {
        walk(path.join(dir, e.name), path.posix.join(base, e.name));
        continue;
      }
      if (!e.name.toLowerCase().endsWith('.html')) continue;
      const rel = path.posix.join(base, e.name);
      // route: strip .html, convert /index to /
      let route = ('/' + rel).replace(/\.html$/i, '');
      route = route.replace(/\\/g, '/');
      if (route.endsWith('/index')) route = route.replace(/\/index$/,'');
      // avoid mapping root index.html to '/', let Next's page handle '/'
      if (route === '') route = '/';
      // destination is the public file path
      const destination = '/pages/' + rel;
      // If there's a Next page already (pages/<name>.jsx|tsx or pages/static/<name>.jsx),
      // skip adding a rewrite so the Next page takes precedence.
      const nameOnly = path.posix.basename(rel, '.html');
      const nextStatic = path.join(process.cwd(), 'pages', 'static', nameOnly + '.jsx');
      const nextPageJsx = path.join(process.cwd(), 'pages', nameOnly + '.jsx');
      const nextPageTsx = path.join(process.cwd(), 'pages', nameOnly + '.tsx');
      const nextPageIndex = path.join(process.cwd(), 'pages', nameOnly, 'index.jsx');
      if (fs.existsSync(nextStatic) || fs.existsSync(nextPageJsx) || fs.existsSync(nextPageTsx) || fs.existsSync(nextPageIndex)) {
        // Skip adding rewrite for routes handled by Next pages
        continue;
      }
      // skip overriding root index
      if (route !== '/') {
        rewrites.push({ source: route, destination });
      }
    }
  }

  walk(pagesDir, '');
  return rewrites;
}

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Disable the dev build activity indicator (removes the small "building/fast refresh" UI)
  devIndicators: {
    buildActivity: false
  },
  // Enable server compression (gzip/brotli where supported) for served HTML and JSON
  compress: true,
  // Ensure SWC minification is used for smaller JS bundles
  swcMinify: true,
  // Do not expose "x-powered-by" header
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.coingecko.com' },
      { protocol: 'https', hostname: '**.cryptoicons.org' },
      { protocol: 'https', hostname: '**.s3.amazonaws.com' },
  { protocol: 'https', hostname: 'cdn.sanity.io' },
  // allow Google-hosted images (used by some RSS/feeds and OpenGraph thumbnails)
  { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
  { protocol: 'https', hostname: 'lh4.googleusercontent.com' },
  { protocol: 'https', hostname: 'lh5.googleusercontent.com' },
  // allow Google Cloud Storage hosts (public objects & bucket-hosted domains)
  { protocol: 'https', hostname: 'storage.googleapis.com' },
  { protocol: 'https', hostname: '*.storage.googleapis.com' },
  { protocol: 'https', hostname: 'fcrhqoiobfkggehbkukh.supabase.co' }
    ],
    // serve modern formats when possible
    formats: ['image/avif', 'image/webp']
  },
  async headers() {
    return [
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ]
      }
    ];
  },
  async rewrites() {
    // Dynamically build rewrites so adding/removing files in public/pages doesn't require editing next.config.
    const staticPageRewrites = collectStaticPageRewrites();
    return staticPageRewrites;
  }
  ,
  async redirects() {
    // Redirect query-based learning-path URLs to pretty slug URLs (301)
    return [
      {
        source: '/learning-path',
        has: [{ type: 'query', key: 'path', value: 'Beginner' }],
        destination: '/learning-path/beginner',
        permanent: true
      },
      {
        source: '/learning-path',
        has: [{ type: 'query', key: 'path', value: 'Intermediate' }],
        destination: '/learning-path/intermediate',
        permanent: true
      },
      {
        source: '/learning-path',
        has: [{ type: 'query', key: 'path', value: 'Advanced' }],
        destination: '/learning-path/advanced',
        permanent: true
      }
    ];
  }
};

export default nextConfig;

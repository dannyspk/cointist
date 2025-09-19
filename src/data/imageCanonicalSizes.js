// Canonical sizes for common images that may be served from remote stores (GCS / CDN).
// Use filename (basename) keys for lookup. Add entries here for logos, common OG images, etc.
module.exports = {
  // publisher logo
  'logo.webp': { width: 1377, height: 448 },
  // example guide image we use in tests
  'DeFi.webp': { width: 1536, height: 1024 },
  // sensible defaults (used when the file basename isn't known)
  '__defaults__': {
    'article': { width: 1200, height: 628 },
    'logo': { width: 600, height: 60 }
  }
};

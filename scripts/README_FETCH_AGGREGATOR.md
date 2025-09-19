fetch-trending-aggregator.js - aggregator

Description:
  Aggregates crypto/blockchain related articles from multiple public sources and RSS feeds, deduplicates and sorts them by publish date.

Default sources:
  reddit, google (Google News RSS), decrypt (Decrypt RSS), nitter (X via Nitter search RSS), coinmarketcap, forbes

Usage examples (PowerShell):
  # Basic (no API keys required for default sources)
  node scripts/fetch-trending-aggregator.js

  # Select sources and output to file
  node scripts/fetch-trending-aggregator.js --sources=reddit,google,nitter --hours=6 --out=./tmp/trending.json

Notes:
  - NewsAPI support was removed (no API key required now).
  - Some sources (Nitter instances, RSS feeds) may be intermittently unavailable.
  - Results are best-effort and intended for prototyping.

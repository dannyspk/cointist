fetch-trending.js

Usage:
  Set NEWSAPI_KEY environment variable and run the script with node.

Examples:
  # Windows PowerShell
  $env:NEWSAPI_KEY = 'your_key_here'; node scripts/fetch-trending.js

  # Write raw JSON to file
  $env:NEWSAPI_KEY = 'your_key_here'; node scripts/fetch-trending.js --out=./tmp/trending.json

Notes:
- Uses NewsAPI.org (https://newsapi.org/). Free tier may restrict sources and rate limits.
- Searches for "crypto OR blockchain" in the last 6 hours.

Pexels helper

This folder contains a small helper to extract keywords from an article title and search Pexels for matching images.

Usage:

1. Set your Pexels API key in the environment:

   Powershell:
   $env:PEXELS_API_KEY = "your_api_key_here"

2. Run the helper:

   npm run pexels:fetch "Your article title here"

Output:
- The script writes a JSON file to `./tmp/pexels/` with search results for each extracted keyword.

Notes:
- This is a lightweight helper for local use. If you want server-side integration (automatic image selection, caching, licensing checks), I can help wire it into the Next.js API routes and UI.

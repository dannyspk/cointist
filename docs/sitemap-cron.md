Sitemap News Cron (Vercel)

This project supports generating a Google News sitemap and uploading it to Google Cloud Storage.

1) Environment variables (set in Vercel dashboard or CI):
- `SITE_URL` (optional, default `https://cointist.net`)
- `SITEMAP_CRON_SECRET` (shared secret for the cron trigger)
- `GCS_BUCKET` (optional; if provided the sitemap will be uploaded to this bucket)
- `GCS_SERVICE_ACCOUNT_KEY` (JSON service account credentials string; required if `GCS_BUCKET` is set)

2) Vercel Cron setup:
- Create a new cron job in Vercel that requests: `https://your-vercel-deployment-url/api/generate-sitemap-news?secret=${SITEMAP_CRON_SECRET}`
- Use `GET` or `POST` (both accepted) and schedule every 15 minutes (or as you prefer).

3) Local testing:
- Start dev server with `SITEMAP_CRON_SECRET` set:
  ```powershell
  $env:SITEMAP_CRON_SECRET = 'your-secret'
  npm run dev
  ```
- Then visit `http://localhost:3000/api/generate-sitemap-news?secret=your-secret` to run and write `public/sitemap-news.xml`.

4) CI / Manual trigger:
- Run `node scripts/upload-sitemap-news.js` with `SITEMAP_CRON_SECRET` and `SITEMAP_ENDPOINT` env vars set to trigger the generation endpoint.

5) Notes:
- The generated sitemap will include articles from the last 48 hours (per Google News requirements).
- If you upload to GCS, the endpoint will return the public GCS URL.
- Consider invalidating CDN cache if you serve the sitemap from a CDN-backed bucket.

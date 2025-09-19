Vercel Cron configuration

This repository includes a `vercel.json` cron entry for calling `/api/generate-sitemap-news` on a schedule. Do NOT commit real secrets into `vercel.json`.

Recommended setup (secure):
- In the Vercel Dashboard for your project, add the environment variable `SITEMAP_CRON_SECRET` to Production.
- In the Dashboard Cron job UI (or in the project settings), add a scheduled job calling `https://<your-domain>/api/generate-sitemap-news` with header `x-sitemap-secret: <value from env>`.

If your Vercel account does not support referencing env vars in `vercel.json` headers, prefer GitHub Actions instead. See `docs/sitemap-cron.md` for more details.

# Changelog: Guides upsert

2025-08-29 — Migration of `wallets-101` guide from local HTML into Supabase `Guides` table

- Added scripts to repository:
  - `scripts/upsert-wallets-101.js` (Prisma local upsert)
  - `scripts/upsert-wallets-101-supabase.js` (Supabase Article upsert)
  - `scripts/upsert-wallets-101-to-guides-supabase.js` (delete Article + upsert Guides)
- Deleted duplicate `Article` row (slug `wallets-101`) from Supabase and created Guides record (author: `Sushant Pawan`).
- Documented process in `docs/gitbook/upsert-guides.md`.

Notes:
- Scripts require `.vercel.env` with `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for Supabase operations.
- Next steps: implement a batch-upsert script that accepts HTML folder or JSON array and performs safe onConflict upserts into `Guides`.

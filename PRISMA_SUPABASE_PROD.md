Production Supabase migration checklist

1) Create a Supabase project and get the URL and SERVICE_ROLE_KEY.

2) Apply Prisma schema to Supabase
   - Set DATABASE_URL to your Supabase database URL (usually in .env)
   - Example .env entries (do NOT commit):
     DATABASE_URL="postgresql://...@db.supabase.co:5432/postgres"
     SUPABASE_URL="https://your-project.supabase.co"
     SUPABASE_ANON_KEY="..."
     SUPABASE_SERVICE_ROLE_KEY="..."

   - Then run (locally or in CI):
     npx prisma migrate deploy --schema=prisma/schema.prisma
     npx prisma generate --schema=prisma/schema.prisma

3) Seed any historical PageView data
   - If you have local views in `prisma/dev.db`, run:
     set SUPABASE_URL="https://..."
     set SUPABASE_SERVICE_ROLE_KEY="..."
     node scripts/import-views-to-supabase.js --dry-run
     # review output
     node scripts/import-views-to-supabase.js

4) Run aggregation job in production
   - Run `node scripts/aggregate-views.js --days=30` as a cron/daily job or as a serverless scheduled function.

5) Wire analytics endpoint
   - Ensure `pages/api/track/view.js` has SUPABASE_* env configured; it will prefer Supabase insert.

Security notes
- Use SUPABASE_SERVICE_ROLE_KEY only on the server (never push to client).
- Keep ANALYTICS_SECRET / JWT_SECRET set for hashing PII like IP and UA.

Troubleshooting
- On Windows, `npx prisma generate` can fail with EPERM if node process locks the query engine; stop dev servers and antivirus may need an exclusion.
- If migrations show "No pending migrations" but DB lacks tables, ensure the DATABASE_URL points to the target DB and re-run `prisma migrate deploy`.

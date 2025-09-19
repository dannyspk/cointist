Quick Prisma + SQLite setup (local dev)

1) Install packages:

   npm install prisma @prisma/client --save-dev

2) Initialize Prisma (creates prisma/schema.prisma if not present):

   npx prisma init --datasource-provider sqlite

3) After confirming `prisma/schema.prisma` (already added), run migration to create SQLite DB and generate client:

   npx prisma migrate dev --name init

4) Start dev server:

   npm run dev

5) Open admin UI:

   http://localhost:3000/admin

Notes:
- The Prisma datasource now reads the connection string from the `DATABASE_URL` environment variable.

- For local development, create a `.env.local` file in the project root with:

```
DATABASE_URL="file:./prisma/dev.db"
```

  Then run `npx prisma migrate dev --name init` to create `prisma/dev.db` and generate the client.

- For production (Vercel), set `DATABASE_URL` in the Project > Settings > Environment Variables.
  - For Postgres: `postgresql://user:pass@host:5432/dbname`
  - For SQLite on remote hosts you generally should use a managed DB instead; set DATABASE_URL accordingly.

Prisma Data Proxy (recommended for serverless / Vercel)
-----------------------------------------------

If your hosting environment (like Vercel) cannot reliably open direct Postgres connections
(for example due to IPv6-only endpoints or restricted outbound ports), use Prisma Data Proxy.

1) Create a Data Proxy in the Prisma console or Prisma Cloud and connect it to your database.
   - Follow Prisma's docs to create a new Data Proxy and obtain the Data Proxy URL.

2) Locally, you can push the schema through the proxy or directly to your DB:

```
# push using data proxy (requires prisma >= 4.14+):
export PRISMA_DATA_PROXY=true
export DATABASE_URL="your-connection-string"
npx prisma db push --data-proxy
npx prisma generate --data-proxy
```

3) In Vercel, set the environment variables for Preview/Production:

- `PRISMA_DATA_PROXY=true`
- `DATABASE_URL` (still set to your Postgres connection string or leave to Data Proxy config if using managed proxy credentials)
- `PRISMA_DATA_PROXY_URL` (if your Data Proxy provider gives a specific client URL; follow provider docs)

4) Use the specialized build command for data proxy in Vercel:

Set Build Command to:

```
npm run vercel-build:dataproxy
```

This runs `prisma generate --data-proxy` before building so the generated client is configured for the proxy.

Notes:
- Data Proxy routes Prisma traffic over HTTPS and removes the need for direct TCP access to your DB from serverless functions.
- Check Prisma docs for exact env names and credential setup for your Data Proxy provider.



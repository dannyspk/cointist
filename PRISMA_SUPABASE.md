This project currently uses a local SQLite file for development (`prisma/dev.db` or `prisma/schema_sqlite.prisma`).

If you have a Supabase SQL export (a `.sql` file) and want to run the project against that data locally, follow these steps.

1) Start a local Postgres (Docker)

On Windows (PowerShell), run:

```powershell
docker run --name cointist-postgres -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=cointist -e POSTGRES_DB=cointist -p 5432:5432 -d postgres:15
```

2) Import the Supabase SQL export into the running container

Assuming your export is `supabase-export.sql` in the project root:

```powershell
docker cp .\supabase-export.sql cointist-postgres:/supabase-export.sql ; docker exec -i cointist-postgres psql -U cointist -d cointist -f /supabase-export.sql
```

3) Point Prisma at the Postgres DB

Set the environment variable `DATABASE_URL` to match the running DB. Example (PowerShell):

```powershell
$env:DATABASE_URL = "postgresql://cointist:pass@localhost:5432/cointist?schema=public"
```

4) Use the Postgres Prisma schema

This repo includes `prisma/schema_postgres.prisma`. Either copy its contents into `prisma/schema.prisma` or run Prisma commands with the `--schema` flag:

```powershell
npx prisma generate --schema=prisma/schema_postgres.prisma
npx prisma db pull --schema=prisma/schema_postgres.prisma
```

5) Start the app

Now run the app (in the same shell where `DATABASE_URL` is set):

```powershell
npm run dev
```

Notes
- If Supabase export contains Postgres-specific types/extensions, you may need to enable them in the container.
- For persistence across restarts, stop/remove the container but keep the DB or mount a volume.
- If you want to keep both SQLite and Postgres schemas, use the `--schema` flag to point Prisma commands at `prisma/schema_postgres.prisma`.

## Upserting Guide articles (Gitbook docs)

This page documents the recent work to import a guide HTML page (`wallets-101.html`) into the project's database and the supporting scripts that were added to the repository.

Files added
- `scripts/upsert-wallets-101.js` — upserts a `wallets-101` article into the local Prisma (SQLite) `Article` table. Useful for local dev/testing.
- `scripts/upsert-wallets-101-supabase.js` — upserts `wallets-101` into Supabase `Article` table (used initially; later moved to `Guides`).
- `scripts/upsert-wallets-101-to-guides-supabase.js` — deletes any `Article` row for `wallets-101` then upserts the same content into Supabase `Guides` table (final location).

Why these scripts exist
- The site separates long-form guide content into a dedicated `Guides` table in Supabase. Existing batch tools were upserting into the legacy `Article` table which blurred categories.
- The scripts provide a reproducible, reviewable way to:
  - extract the guide HTML content,
  - pick an author from the Opinions list,
  - upsert into the correct Supabase table by `slug`, and
  - safely delete the prior `Article` entry before the Guides upsert (to avoid duplicates).

How the scripts work (high level)
- Local Prisma upsert (`scripts/upsert-wallets-101.js`): uses the repo's `src/lib/prisma` client and `prisma.article.upsert` to create or update the article in the local SQLite DB (dev). Also creates a publishedAt timestamp.
- Supabase upsert (`scripts/upsert-wallets-101-supabase.js`): uses `.vercel.env` credentials and Supabase Service Role key to call `supabase.from('Article').upsert([...], { onConflict: 'slug' })`.
- Guides upsert with migration (`scripts/upsert-wallets-101-to-guides-supabase.js`): first deletes any `Article` rows with the `wallets-101` slug, then calls `supabase.from('Guides').upsert([...], { onConflict: 'slug' })` to insert into the `Guides` table. The author chosen for the Guides record in the script is an existing Opinions author (`Sushant Pawan`).

Environment / prerequisites
- Node.js installed (tested with Node 18+ locally)
- `.vercel.env` in the project root with the following variables for Supabase scripts:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY

Running the scripts (PowerShell)
To upsert locally into Prisma (dev):

```powershell
node .\scripts\upsert-wallets-101.js
```

To upsert to Supabase (Article table):

```powershell
node .\scripts\upsert-wallets-101-supabase.js
```

To remove any Article rows and upsert into the Guides table (recommended):

```powershell
node .\scripts\upsert-wallets-101-to-guides-supabase.js
```

Verification
- Scripts print the Supabase/Prisma returned row(s). Example outputs captured during the work:
  - Prisma upsert printed: "Upserted: 1259 wallets-101 Wallets 101: Custodial vs Non‑Custodial"
  - Supabase upsert initially returned an Article row (id 45). After migration script run the Article row was deleted and Guides upsert returned id 46.

Author selection rule
- For this one-off, the Guides record uses an Opinions author: `Sushant Pawan`.
- For batch imports we can choose one of two rules:
  1) Provide author per source file (recommended), or
  2) Auto-select an Opinions author at random or round-robin (if no explicit author provided).

Batch upload options (next steps)
- Option A: Folder input
  - Place `.html` files under a folder (e.g. `data/guides-html/`) and run a script that parses each HTML, extracts <title>, meta description, <article>…</article> and related aside, then upserts into `Guides`.
- Option B: JSON array
  - Prepare a JSON array of article objects ({ slug, title, content, excerpt, author, publishedAt }) and call Supabase `upsert` in batches of e.g. 100.
- Option C: CSV
  - A CSV mapping slug -> title -> htmlFilePath -> author. Convert to JSON and call the upsert script.

Recommendation
- For reliable metadata and author selection, I recommend Option B (JSON array) produced from a small ETL that reads the HTML files, extracts metadata, and writes a single `guides-to-upsert.json`. This file can be reviewed before running the Supabase upsert (safe, auditable).

Security note
- The scripts use the Supabase Service Role key which has elevated privileges. Keep `.vercel.env` out of source control and never expose the service role key publicly.

Where to find the new docs
- This file: `docs/gitbook/upsert-guides.md` (add to your GitBook sidebar or copy the contents into an existing doc page).

If you want, I can:
- Add a parameterized batch-upsert script (HTML folder or JSON input) and DRY the code (one script for both Article/Guides paths).
- Create a Git commit/PR with these docs and the scripts packaged for review.

Search index setup for Supabase/Postgres

This project ships a lightweight SQL migration to add full-text search support for fast suggestions.

Steps to enable (Supabase SQL editor or psql):

1. Open your Supabase project > SQL Editor.
2. Create a new query and paste the contents of `db/migrations/20250829_add_search_index.sql`.
3. Run the query. This will:
   - add a `search_tsv` tsvector column to `Article` and `Guides` tables,
   - populate existing rows,
   - create triggers to keep the column updated on insert/update,
   - add GIN indexes for fast search,
   - and add an RPC function `search_articles(q, lim)` that the suggest endpoint uses.

Notes and alternatives:
- The RPC function here is simple and searches each table independently. You may want to refine it to merge results and limit across both tables for consistent limits.
- If you prefer a single unified table for search, consider creating a materialized view and indexing it.
- Test the RPC in the Supabase SQL editor by running:
  SELECT * FROM public.search_articles('staking', 8);

Security:
- The suggest endpoint calls the RPC using the Supabase client; ensure your API key has permission (the anon key typically can call RPCs). If you use a restricted key, ensure it allows the RPC.

Additional: merged RPC
- After running the initial migration, you can apply `db/migrations/20250829_update_search_rpc.sql` to replace the RPC
  with a merged/limited implementation that ranks results across both `Article` and `Guides` and returns the top N overall.
  This is recommended so the suggest endpoint returns the best matches across both tables.

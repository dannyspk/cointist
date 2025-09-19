-- Migration: update search_articles RPC to merge results across Article + Guides and limit overall
-- Run this in your Postgres/Supabase SQL editor to replace the previous RPC with a merged, ranked implementation.

-- Drop existing function if present
DROP FUNCTION IF EXISTS public.search_articles(text, integer);

-- Create a merged search function that ranks results from both Article and Guides and returns the top `lim`
CREATE OR REPLACE FUNCTION public.search_articles(q text, lim integer DEFAULT 8)
RETURNS TABLE(id int, title text, slug text, thumbnail text) LANGUAGE sql STABLE AS $$
  WITH matches AS (
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, publishedat
    FROM "Article"
    WHERE search_tsv @@ plainto_tsquery('english', q)
    UNION ALL
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, publishedat
    FROM "Guides"
    WHERE search_tsv @@ plainto_tsquery('english', q)
  )
  SELECT id, title, slug, thumbnail
  FROM matches
  ORDER BY rank DESC, publishedat DESC
  LIMIT lim;
$$;

-- Notes:
-- * This merges results from both tables, ranks them by tsvector rank (and publishedAt tie-breaker),
--   and applies a single LIMIT across the combined set so callers get the best N results overall.
-- * Ensure the `search_tsv` tsvector columns and GIN indexes exist (see earlier migration 20250829_add_search_index.sql).
-- * Test with: SELECT * FROM public.search_articles('staking', 8);

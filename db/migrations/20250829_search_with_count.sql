-- Migration: add RPC that returns rows + total for paginated full-text search
-- Run this in Supabase SQL editor or psql.

DROP FUNCTION IF EXISTS public.search_articles_with_count(text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_articles_with_count(q text, lim int DEFAULT 8, off int DEFAULT 0)
RETURNS json LANGUAGE sql STABLE AS $$
WITH matches AS (
  SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, publishedat
  FROM "Article"
  WHERE search_tsv @@ plainto_tsquery('english', q)
  UNION ALL
  SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, publishedat
  FROM "Guides"
  WHERE search_tsv @@ plainto_tsquery('english', q)
),
numbered AS (
  SELECT *, ROW_NUMBER() OVER (ORDER BY rank DESC, publishedat DESC) AS rn
  FROM matches
)
SELECT json_build_object(
  'total', (SELECT COUNT(*) FROM matches),
  'rows', COALESCE((SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, title, slug, thumbnail
      FROM numbered
      WHERE rn > off AND rn <= off + lim
      ORDER BY rank DESC, publishedat DESC
    ) t), '[]'::json)
);
$$;

-- Test: SELECT public.search_articles_with_count('staking', 10, 0);

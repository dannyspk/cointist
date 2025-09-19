-- Migration: add tsvector search index and RPC search_articles
-- Run this in your Postgres/Supabase SQL editor.

-- 1) Add a tsvector column to Article and Guides (nullable)
ALTER TABLE "Article" ADD COLUMN IF NOT EXISTS search_tsv tsvector;
ALTER TABLE "Guides" ADD COLUMN IF NOT EXISTS search_tsv tsvector;

-- 2) Populate existing rows
UPDATE "Article" SET search_tsv = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'')) WHERE search_tsv IS NULL;
UPDATE "Guides" SET search_tsv = to_tsvector('english', coalesce(title,'') || ' ' || coalesce(excerpt,'')) WHERE search_tsv IS NULL;

-- 3) Create trigger function to keep tsvector updated
CREATE OR REPLACE FUNCTION articles_search_tsv_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_tsv := to_tsvector('english', coalesce(NEW.title,'') || ' ' || coalesce(NEW.excerpt,''));
  RETURN NEW;
END
$$;

-- 4) Attach triggers
-- Drop triggers if they already exist to make this migration idempotent
DROP TRIGGER IF EXISTS article_search_tsv_update ON "Article";
CREATE TRIGGER article_search_tsv_update BEFORE INSERT OR UPDATE ON "Article"
FOR EACH ROW EXECUTE PROCEDURE articles_search_tsv_trigger();

DROP TRIGGER IF EXISTS guides_search_tsv_update ON "Guides";
CREATE TRIGGER guides_search_tsv_update BEFORE INSERT OR UPDATE ON "Guides"
FOR EACH ROW EXECUTE PROCEDURE articles_search_tsv_trigger();

-- 5) Create GIN index for fast search
CREATE INDEX IF NOT EXISTS idx_article_search_tsv ON "Article" USING GIN (search_tsv);
CREATE INDEX IF NOT EXISTS idx_guides_search_tsv ON "Guides" USING GIN (search_tsv);

-- 6) Create a search RPC that searches both tables and returns canonical fields
CREATE OR REPLACE FUNCTION public.search_articles(q text, lim integer DEFAULT 8)
RETURNS TABLE(id int, title text, slug text, thumbnail text) LANGUAGE sql STABLE AS $$
  -- Combine matches from both tables, compute a rank per-row, then order & limit the final result.
  SELECT id, title, slug, thumbnail
  FROM (
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, "publishedAt"
    FROM "Article"
    WHERE search_tsv @@ plainto_tsquery('english', q)
    UNION ALL
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, "publishedAt"
    FROM "Guides"
    WHERE search_tsv @@ plainto_tsquery('english', q)
  ) AS combined
  ORDER BY rank DESC, "publishedAt" DESC
  LIMIT lim;
$$;

-- Note: this version combines rows from both tables first, orders by the computed rank
-- across the combined set, then limits to `lim` overall. This avoids invalid per-SELECT
-- ORDER BY/LIMIT clauses in UNIONed queries.

-- 7) Create a search RPC that returns rows + total for accurate pagination
CREATE OR REPLACE FUNCTION public.search_articles_with_count(q text, lim int DEFAULT 8, off int DEFAULT 0)
RETURNS json LANGUAGE plpgsql STABLE AS $$
DECLARE
  total bigint := 0;
  rows json := '[]'::json;
BEGIN
  WITH matches AS (
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, "publishedAt"
    FROM "Article"
    WHERE search_tsv @@ plainto_tsquery('english', q)
    UNION ALL
    SELECT id, title, slug, thumbnail, ts_rank(search_tsv, plainto_tsquery('english', q)) AS rank, "publishedAt"
    FROM "Guides"
    WHERE search_tsv @@ plainto_tsquery('english', q)
  ), numbered AS (
    SELECT id, title, slug, thumbnail, rank, "publishedAt",
      ROW_NUMBER() OVER (ORDER BY rank DESC, "publishedAt" DESC) AS rn
    FROM matches
  )
  SELECT count(*) INTO total FROM matches;

  SELECT json_agg(json_build_object('id', id, 'title', title, 'slug', slug, 'thumbnail', thumbnail)) INTO rows
  FROM (
    SELECT id, title, slug, thumbnail
    FROM numbered
    WHERE rn > off AND rn <= off + lim
    ORDER BY rn
  ) AS page;

  RETURN json_build_object('total', total, 'rows', COALESCE(rows, '[]'::json));
END;
$$;

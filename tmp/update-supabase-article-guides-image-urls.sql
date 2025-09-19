-- Safe update for Supabase / Postgres
-- Replaces trailing .png/.jpg/.jpeg on image URL columns with .webp
-- Review before running on production. Backup your DB first.

-- Article table: update known columns if they exist
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Article' AND column_name='coverImage') THEN
    EXECUTE $$
      UPDATE "Article"
      SET "coverImage" = regexp_replace("coverImage", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "coverImage" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Article' AND column_name='thumbnail') THEN
    EXECUTE $$
      UPDATE "Article"
      SET "thumbnail" = regexp_replace("thumbnail", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "thumbnail" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;
END$$;

-- Guides table: check multiple common column names and update if present
DO $$
BEGIN
  -- cover variants
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='coverImage') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "coverImage" = regexp_replace("coverImage", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "coverImage" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='cover') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "cover" = regexp_replace("cover", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "cover" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='cover_image') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "cover_image" = regexp_replace("cover_image", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "cover_image" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  -- thumbnail variants
  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='thumbnail') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "thumbnail" = regexp_replace("thumbnail", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "thumbnail" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='thumbnail_image') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "thumbnail_image" = regexp_replace("thumbnail_image", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "thumbnail_image" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;

  IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='Guides' AND column_name='thumb') THEN
    EXECUTE $$
      UPDATE "Guides"
      SET "thumb" = regexp_replace("thumb", '\\.(png|jpe?g)$', '.webp', 'i')
      WHERE "thumb" ~* '\\.(png|jpe?g)$';
    $$;
  END IF;
END$$;

-- End of script

-- Generated SQL to update image URL extensions to .webp
-- Review before running. Backup your DB first.
-- generatedAt: 2025-09-12T04:12:36.562Z
BEGIN;
/* Article.coverImage */
UPDATE Article
SET coverImage = regexp_replace(coverImage, '\.(png|jpe?g)$', '.webp', 'i')
WHERE coverImage ~* '\.(png|jpe?g)$';

/* Article.thumbnail */
UPDATE Article
SET thumbnail = regexp_replace(thumbnail, '\.(png|jpe?g)$', '.webp', 'i')
WHERE thumbnail ~* '\.(png|jpe?g)$';

/* Guides.coverImage */
UPDATE Guides
SET coverImage = regexp_replace(coverImage, '\.(png|jpe?g)$', '.webp', 'i')
WHERE coverImage ~* '\.(png|jpe?g)$';

/* Guides.thumbnail */
UPDATE Guides
SET thumbnail = regexp_replace(thumbnail, '\.(png|jpe?g)$', '.webp', 'i')
WHERE thumbnail ~* '\.(png|jpe?g)$';

/* authors.avatar_url */
UPDATE authors
SET avatar_url = regexp_replace(avatar_url, '\.(png|jpe?g)$', '.webp', 'i')
WHERE avatar_url ~* '\.(png|jpe?g)$';

/* uploads.path */
UPDATE uploads
SET path = regexp_replace(path, '\.(png|jpe?g)$', '.webp', 'i')
WHERE path ~* '\.(png|jpe?g)$';

-- COMMIT; -- uncomment to commit automatically
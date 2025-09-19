-- CreateTable
CREATE TABLE "ArticleVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "author" TEXT,
    "coverImage" TEXT,
    "thumbnail" TEXT,
    "subcategory" TEXT,
    "tags" JSONB,
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "excerpt" TEXT,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "scheduledAt" DATETIME,
    "coverAlt" TEXT,
    "thumbnailAlt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" DATETIME,
    "featuredOnly" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Article" ("author", "category", "content", "coverAlt", "coverImage", "createdAt", "excerpt", "id", "pinned", "pinnedAt", "published", "publishedAt", "scheduledAt", "slug", "subcategory", "thumbnail", "thumbnailAlt", "title", "updatedAt") SELECT "author", "category", "content", "coverAlt", "coverImage", "createdAt", "excerpt", "id", "pinned", "pinnedAt", "published", "publishedAt", "scheduledAt", "slug", "subcategory", "thumbnail", "thumbnailAlt", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ArticleVersion_articleId_idx" ON "ArticleVersion"("articleId");

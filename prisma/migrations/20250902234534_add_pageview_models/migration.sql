-- CreateTable
CREATE TABLE "PageView" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER,
    "slug" TEXT,
    "path" TEXT,
    "referrer" TEXT,
    "ipHash" TEXT,
    "uaHash" TEXT,
    "sessionId" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PageViewDaily" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER,
    "slug" TEXT,
    "day" DATETIME NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniques" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "PageViewDaily_articleId_day_idx" ON "PageViewDaily"("articleId", "day");

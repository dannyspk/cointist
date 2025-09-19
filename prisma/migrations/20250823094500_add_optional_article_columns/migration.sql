-- Add optional columns to Article to match schema.prisma
ALTER TABLE "Article" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "Article" ADD COLUMN "coverAlt" TEXT;
ALTER TABLE "Article" ADD COLUMN "thumbnailAlt" TEXT;

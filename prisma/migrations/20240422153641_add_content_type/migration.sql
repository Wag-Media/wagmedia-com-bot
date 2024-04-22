-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('news', 'article');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "contentType" "ContentType";

UPDATE "Post"
SET "contentType" = CASE
  WHEN "discordLink" LIKE '%960677080784330793%' OR "discordLink" LIKE '%985566609689169920%' THEN 'article'
  WHEN "discordLink" LIKE '%919836627608690699%' THEN 'news'
  ELSE NULL
END;
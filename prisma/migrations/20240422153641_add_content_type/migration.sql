-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('news', 'article');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "contentType" "ContentType";

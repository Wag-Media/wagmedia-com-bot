/*
  Warnings:

  - You are about to drop the column `contentUrl` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `embedImageUrl` on the `Post` table. All the data in the column will be lost.
  - Made the column `content` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "contentUrl",
DROP COLUMN "embedImageUrl",
ALTER COLUMN "content" SET NOT NULL;

-- CreateTable
CREATE TABLE "Embed" (
    "id" TEXT NOT NULL,
    "embedUrl" TEXT,
    "embedImage" TEXT,
    "embedColor" INTEGER,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Embed_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Embed" DROP CONSTRAINT "Embed_postId_fkey";

-- AlterTable
ALTER TABLE "Embed" ALTER COLUMN "postId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

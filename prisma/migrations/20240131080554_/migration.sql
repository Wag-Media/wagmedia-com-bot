/*
  Warnings:

  - A unique constraint covering the columns `[oddJobId,userDiscordId,emojiId]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Reaction" DROP CONSTRAINT "Reaction_postId_fkey";

-- AlterTable
ALTER TABLE "Reaction" ADD COLUMN     "oddJobId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_oddJobId_userDiscordId_emojiId_key" ON "Reaction"("oddJobId", "userDiscordId", "emojiId");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_oddJobId_fkey" FOREIGN KEY ("oddJobId") REFERENCES "OddJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

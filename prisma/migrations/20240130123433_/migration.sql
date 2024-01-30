/*
  Warnings:

  - You are about to drop the column `discorLink` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "discorLink",
ADD COLUMN     "discordLink" TEXT;

/*
  Warnings:

  - You are about to drop the column `eventId` on the `Embed` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Embed" DROP CONSTRAINT "Embed_eventId_fkey";

-- AlterTable
ALTER TABLE "Embed" DROP COLUMN "eventId",
ADD COLUMN     "polkadotEventId" TEXT;

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_polkadotEventId_fkey" FOREIGN KEY ("polkadotEventId") REFERENCES "PolkadotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

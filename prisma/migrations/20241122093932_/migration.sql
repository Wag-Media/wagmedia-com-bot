/*
  Warnings:

  - You are about to drop the column `publishedAt` on the `OddJob` table. All the data in the column will be lost.
  - You are about to drop the column `publishedAt` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "OddJob" DROP COLUMN "publishedAt",
ADD COLUMN     "firstPaymentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "publishedAt",
ADD COLUMN     "firstPaymentAt" TIMESTAMP(3);

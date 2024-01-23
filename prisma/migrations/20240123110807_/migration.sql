/*
  Warnings:

  - You are about to drop the column `currencyUnit` on the `PostEarnings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[postId,unit]` on the table `PostEarnings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unit` to the `PostEarnings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PostEarnings_postId_currencyUnit_key";

-- AlterTable
ALTER TABLE "PostEarnings" DROP COLUMN "currencyUnit",
ADD COLUMN     "unit" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PostEarnings_postId_unit_key" ON "PostEarnings"("postId", "unit");

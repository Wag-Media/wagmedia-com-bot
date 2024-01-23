/*
  Warnings:

  - You are about to drop the column `totalEarnings` on the `Post` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Post" DROP COLUMN "totalEarnings";

-- CreateTable
CREATE TABLE "PostEarnings" (
    "id" SERIAL NOT NULL,
    "postId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currencyUnit" TEXT NOT NULL,

    CONSTRAINT "PostEarnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostEarnings_postId_currencyUnit_key" ON "PostEarnings"("postId", "currencyUnit");

-- AddForeignKey
ALTER TABLE "PostEarnings" ADD CONSTRAINT "PostEarnings_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

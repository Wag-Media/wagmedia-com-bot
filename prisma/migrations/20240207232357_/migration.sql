/*
  Warnings:

  - You are about to drop the `PostEarnings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "PostEarnings" DROP CONSTRAINT "PostEarnings_postId_fkey";

-- DropTable
DROP TABLE "PostEarnings";

-- CreateTable
CREATE TABLE "ContentEarnings" (
    "id" SERIAL NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "postId" TEXT,
    "oddJobId" TEXT,

    CONSTRAINT "ContentEarnings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentEarnings_postId_unit_key" ON "ContentEarnings"("postId", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "ContentEarnings_oddJobId_unit_key" ON "ContentEarnings"("oddJobId", "unit");

-- AddForeignKey
ALTER TABLE "ContentEarnings" ADD CONSTRAINT "ContentEarnings_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentEarnings" ADD CONSTRAINT "ContentEarnings_oddJobId_fkey" FOREIGN KEY ("oddJobId") REFERENCES "OddJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

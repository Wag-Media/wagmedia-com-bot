/*
  Warnings:

  - The primary key for the `OddJob` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_oddJobId_fkey";

-- AlterTable
ALTER TABLE "OddJob" DROP CONSTRAINT "OddJob_pkey",
ADD COLUMN     "discordLink" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "OddJob_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "OddJob_id_seq";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "oddJobId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_oddJobId_fkey" FOREIGN KEY ("oddJobId") REFERENCES "OddJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

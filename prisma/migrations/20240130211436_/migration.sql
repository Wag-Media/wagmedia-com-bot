-- DropForeignKey
ALTER TABLE "OddJob" DROP CONSTRAINT "OddJob_managerId_fkey";

-- DropForeignKey
ALTER TABLE "OddJob" DROP CONSTRAINT "OddJob_userId_fkey";

-- AlterTable
ALTER TABLE "OddJob" ALTER COLUMN "managerId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "OddJob" ADD CONSTRAINT "OddJob_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddJob" ADD CONSTRAINT "OddJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

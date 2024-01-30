/*
  Warnings:

  - You are about to drop the column `manager` on the `OddJob` table. All the data in the column will be lost.
  - Added the required column `managerId` to the `OddJob` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `OddJob` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "OddJob" DROP COLUMN "manager",
ADD COLUMN     "managerId" INTEGER NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "OddJob" ADD CONSTRAINT "OddJob_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OddJob" ADD CONSTRAINT "OddJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

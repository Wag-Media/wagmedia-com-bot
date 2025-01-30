/*
  Warnings:

  - You are about to drop the column `date` on the `PolkadotEvent` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PolkadotEvent" DROP COLUMN "date",
ADD COLUMN     "endDate" DATE,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "isAllDay" BOOLEAN DEFAULT false,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrencePattern" TEXT,
ADD COLUMN     "startDate" DATE,
ADD COLUMN     "startsAt" TIMESTAMP(3);

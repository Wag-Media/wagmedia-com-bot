/*
  Warnings:

  - A unique constraint covering the columns `[eventId,unit]` on the table `ContentEarnings` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[eventId,userId,reactionId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ContentEarnings_eventId_unit_key" ON "ContentEarnings"("eventId", "unit");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_eventId_userId_reactionId_key" ON "Payment"("eventId", "userId", "reactionId");

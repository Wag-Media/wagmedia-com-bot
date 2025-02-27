/*
  Warnings:

  - A unique constraint covering the columns `[eventId,userDiscordId,emojiId]` on the table `Reaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Reaction_eventId_userDiscordId_emojiId_key" ON "Reaction"("eventId", "userDiscordId", "emojiId");

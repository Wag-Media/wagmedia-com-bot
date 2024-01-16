-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_reactionId_fkey";

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reactionId_fkey" FOREIGN KEY ("reactionId") REFERENCES "Reaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

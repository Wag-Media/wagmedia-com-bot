-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "threadParentId" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_threadParentId_fkey" FOREIGN KEY ("threadParentId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

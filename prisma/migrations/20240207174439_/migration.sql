/*
  Warnings:

  - A unique constraint covering the columns `[paymentAmount,paymentUnit,fundingSource]` on the table `PaymentRule` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "PaymentRule_paymentAmount_paymentUnit_key";

-- AlterTable
ALTER TABLE "PaymentRule" ADD COLUMN     "fundingSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRule_paymentAmount_paymentUnit_fundingSource_key" ON "PaymentRule"("paymentAmount", "paymentUnit", "fundingSource");

/*
  Warnings:

  - A unique constraint covering the columns `[paymentAmount,paymentUnit]` on the table `PaymentRule` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `unit` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "unit" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRule_paymentAmount_paymentUnit_key" ON "PaymentRule"("paymentAmount", "paymentUnit");

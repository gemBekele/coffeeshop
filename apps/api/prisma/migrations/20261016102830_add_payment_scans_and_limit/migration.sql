-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'MATCHED');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confirmedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "paymentMaxAmount" DECIMAL(12,2) NOT NULL DEFAULT 1000;

-- CreateTable
CREATE TABLE "PaymentScan" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "staffId" TEXT,
    "txnId" TEXT,
    "amount" DECIMAL(12,2),
    "sender" TEXT,
    "rawText" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentScan_shopId_status_idx" ON "PaymentScan"("shopId", "status");

-- CreateIndex
CREATE INDEX "PaymentScan_shopId_createdAt_idx" ON "PaymentScan"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentScan_paymentId_idx" ON "PaymentScan"("paymentId");

-- AddForeignKey
ALTER TABLE "PaymentScan" ADD CONSTRAINT "PaymentScan_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentScan" ADD CONSTRAINT "PaymentScan_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentScan" ADD CONSTRAINT "PaymentScan_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

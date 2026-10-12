-- CreateTable
CREATE TABLE "StaffPairing" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "deviceId" TEXT,
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPairing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPairing_code_key" ON "StaffPairing"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPairing_token_key" ON "StaffPairing"("token");

-- CreateIndex
CREATE INDEX "StaffPairing_shopId_idx" ON "StaffPairing"("shopId");

-- CreateIndex
CREATE INDEX "StaffPairing_staffId_idx" ON "StaffPairing"("staffId");

-- CreateIndex
CREATE INDEX "StaffPairing_status_idx" ON "StaffPairing"("status");

-- CreateIndex
CREATE INDEX "StaffPairing_expiresAt_idx" ON "StaffPairing"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffPairing" ADD CONSTRAINT "StaffPairing_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPairing" ADD CONSTRAINT "StaffPairing_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPairing" ADD CONSTRAINT "StaffPairing_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

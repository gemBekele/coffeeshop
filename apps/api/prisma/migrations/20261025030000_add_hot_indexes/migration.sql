-- Speed up the shop-scoped, time-ordered reads used by every screen.
CREATE INDEX "Payment_shopId_receivedAt_idx" ON "Payment"("shopId", "receivedAt");
CREATE INDEX "Payment_shopId_status_idx" ON "Payment"("shopId", "status");
CREATE INDEX "UnmatchedSms_shopId_receivedAt_idx" ON "UnmatchedSms"("shopId", "receivedAt");

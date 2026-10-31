-- CreateTable
CREATE TABLE "KvEntry" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KvEntry_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "KvEntry_expiresAt_idx" ON "KvEntry"("expiresAt");

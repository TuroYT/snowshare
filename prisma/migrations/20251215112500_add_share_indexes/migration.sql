-- CreateIndex
CREATE INDEX "Share_ownerId_idx" ON "Share"("ownerId");

-- CreateIndex
CREATE INDEX "Share_createdAt_idx" ON "Share"("createdAt");

-- CreateIndex
CREATE INDEX "Share_expiresAt_idx" ON "Share"("expiresAt");

-- CreateIndex
CREATE INDEX "Share_type_idx" ON "Share"("type");

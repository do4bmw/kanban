-- CreateTable
CREATE TABLE "AuditLog" (
    "id"         TEXT         NOT NULL,
    "action"     TEXT         NOT NULL,
    "entityType" TEXT         NOT NULL,
    "entityId"   TEXT,
    "summary"    TEXT,
    "metadata"   JSONB,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"     TEXT,
    "userName"   TEXT,
    "userEmail"  TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

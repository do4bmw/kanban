-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATED', 'MOVED', 'EDITED', 'ASSIGNED', 'UNASSIGNED', 'DUE_DATE_SET', 'DUE_DATE_CLEARED', 'ARCHIVED', 'UNARCHIVED', 'LABEL_ADDED', 'LABEL_REMOVED', 'NOTE_ADDED', 'PRIORITY_CHANGED');

-- AlterTable
ALTER TABLE "Card"
  ADD COLUMN "archived"       BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "priority"       "Priority"   NOT NULL DEFAULT 'NONE',
  ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CardActivity" (
    "id"        TEXT         NOT NULL,
    "type"      "ActivityType" NOT NULL,
    "data"      JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId"    TEXT         NOT NULL,
    "userId"    TEXT,

    CONSTRAINT "CardActivity_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CardActivity" ADD CONSTRAINT "CardActivity_cardId_fkey"
  FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardActivity" ADD CONSTRAINT "CardActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Index for fast card activity lookup
CREATE INDEX "CardActivity_cardId_createdAt_idx" ON "CardActivity"("cardId", "createdAt");

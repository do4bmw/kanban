-- AlterTable: add createdById (nullable for backward compat)
ALTER TABLE "Card" ADD COLUMN "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

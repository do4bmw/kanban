-- CreateTable
CREATE TABLE "CardNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,

    CONSTRAINT "CardNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CardNote" ADD CONSTRAINT "CardNote_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardNote" ADD CONSTRAINT "CardNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

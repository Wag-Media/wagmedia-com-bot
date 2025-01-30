-- AlterTable
ALTER TABLE "ContentEarnings" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "Embed" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "Reaction" ADD COLUMN     "eventId" TEXT;

-- CreateTable
CREATE TABLE "PolkadotEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "date" TIMESTAMP(3),
    "link" TEXT,
    "image" TEXT,
    "discordLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstPaymentAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "PolkadotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventTags" (
    "A" TEXT NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_EventTags_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolkadotEvent_slug_key" ON "PolkadotEvent"("slug");

-- CreateIndex
CREATE INDEX "_EventTags_B_index" ON "_EventTags"("B");

-- AddForeignKey
ALTER TABLE "ContentEarnings" ADD CONSTRAINT "ContentEarnings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolkadotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolkadotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolkadotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Embed" ADD CONSTRAINT "Embed_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "PolkadotEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolkadotEvent" ADD CONSTRAINT "PolkadotEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventTags" ADD CONSTRAINT "_EventTags_A_fkey" FOREIGN KEY ("A") REFERENCES "PolkadotEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventTags" ADD CONSTRAINT "_EventTags_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

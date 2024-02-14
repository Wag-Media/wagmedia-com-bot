-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "oddJobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attachment_oddJobId_idx" ON "Attachment"("oddJobId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_oddJobId_fkey" FOREIGN KEY ("oddJobId") REFERENCES "OddJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

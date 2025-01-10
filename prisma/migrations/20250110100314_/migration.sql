-- AlterTable
ALTER TABLE "User" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "twitterUsername" TEXT;

-- AlterTable
ALTER TABLE "_CategoryToPost" ADD CONSTRAINT "_CategoryToPost_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CategoryToPost_AB_unique";

-- AlterTable
ALTER TABLE "_PostTags" ADD CONSTRAINT "_PostTags_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PostTags_AB_unique";

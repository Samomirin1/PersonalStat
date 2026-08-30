-- AlterTable
ALTER TABLE "Season" ADD COLUMN     "edition" TEXT NOT NULL DEFAULT '2K26';

-- CreateIndex
CREATE INDEX "Season_edition_idx" ON "Season"("edition");


-- DropForeignKey
ALTER TABLE "GamePlayerStat" DROP CONSTRAINT "GamePlayerStat_playerId_fkey";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "gameNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Game_gameNumber_key" ON "Game"("gameNumber");

-- AddForeignKey
ALTER TABLE "GamePlayerStat" ADD CONSTRAINT "GamePlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;


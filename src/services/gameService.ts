import type { Game, GamePlayerStat, Player } from "@prisma/client";
import { prisma } from "./db";
import { resolvePlayer, type MatchType } from "./playerMatcher";
import type { ParsedBoxScore } from "../types";

export interface PlayerMatchSummary {
  gamertag: string;
  matchType: MatchType;
  matchedFrom?: string;
}

export interface SaveGameResult {
  gameId: string;
  gameNumber: number;
  matches: PlayerMatchSummary[];
}

export async function saveParsedGame(
  parsed: ParsedBoxScore,
  seasonId: string,
  submittedBy: string,
  screenshotUrl?: string
): Promise<SaveGameResult> {
  const teamAWon = parsed.teamA.score > parsed.teamB.score;

  const game = await prisma.game.create({
    data: {
      seasonId,
      teamAName: parsed.teamA.name,
      teamBName: parsed.teamB.name,
      teamAScore: parsed.teamA.score,
      teamBScore: parsed.teamB.score,
      submittedBy,
      screenshotUrl,
    },
  });

  const matches: PlayerMatchSummary[] = [];
  const sides = [
    { team: "A" as const, data: parsed.teamA, won: teamAWon },
    { team: "B" as const, data: parsed.teamB, won: !teamAWon },
  ];

  for (const side of sides) {
    for (const row of side.data.players) {
      const match = await resolvePlayer(row.gamertag);
      matches.push({ gamertag: row.gamertag, matchType: match.matchType, matchedFrom: match.matchedFrom });

      await prisma.gamePlayerStat.create({
        data: {
          gameId: game.id,
          playerId: match.player.id,
          team: side.team,
          grade: row.grade,
          points: row.points,
          rebounds: row.rebounds,
          assists: row.assists,
          steals: row.steals,
          blocks: row.blocks,
          fouls: row.fouls,
          turnovers: row.turnovers,
          fgm: row.fgm,
          fga: row.fga,
          tpm: row.tpm,
          tpa: row.tpa,
          ftm: row.ftm,
          fta: row.fta,
          won: side.won,
        },
      });
    }
  }

  return { gameId: game.id, gameNumber: game.gameNumber, matches };
}

export type GameWithStats = Game & { playerStats: (GamePlayerStat & { player: Player })[] };

export async function getGameByNumber(gameNumber: number): Promise<GameWithStats | null> {
  return prisma.game.findUnique({
    where: { gameNumber },
    include: { playerStats: { include: { player: true } } },
  });
}

export async function deleteGameByNumber(gameNumber: number): Promise<Game> {
  const game = await prisma.game.findUnique({ where: { gameNumber } });
  if (!game) throw new Error(`No game #${gameNumber} found.`);
  await prisma.game.delete({ where: { id: game.id } });
  return game;
}

export async function getRecentGames(limit = 10): Promise<Game[]> {
  return prisma.game.findMany({ orderBy: { gameNumber: "desc" }, take: limit });
}

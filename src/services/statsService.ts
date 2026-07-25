import type { Season } from "@prisma/client";
import { prisma } from "./db";
import type { StatChoice } from "../types";

export async function getActiveSeason(): Promise<Season | null> {
  return prisma.season.findFirst({ where: { isActive: true } });
}

// Called at bot startup so /stats always has a season to attach games to.
export async function ensureActiveSeason(): Promise<Season> {
  const existing = await getActiveSeason();
  if (existing) return existing;
  return prisma.season.create({ data: { name: "Season 1", isActive: true } });
}

export async function startNewSeason(name: string): Promise<Season> {
  await prisma.season.updateMany({
    where: { isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });
  return prisma.season.create({ data: { name, isActive: true } });
}

export async function getSeasonByName(name: string): Promise<Season | null> {
  return prisma.season.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
}

export async function searchSeasonNames(query: string, limit = 25): Promise<string[]> {
  const seasons = await prisma.season.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return seasons.map((s) => s.name);
}

interface StatRow {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  won: boolean;
}

export interface AggregatedStats {
  gp: number;
  wins: number;
  losses: number;
  winPct: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  topg: number;
  fgPct: number;
  tpPct: number;
  ftPct: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

function pct(made: number, attempted: number): number {
  return attempted > 0 ? (made / attempted) * 100 : 0;
}

function aggregateRows(rows: StatRow[]): AggregatedStats {
  const gp = rows.length;
  const wins = rows.filter((r) => r.won).length;
  const sum = (key: keyof StatRow) => rows.reduce((acc, r) => acc + (r[key] as number), 0);

  const points = sum("points");
  const rebounds = sum("rebounds");
  const assists = sum("assists");
  const steals = sum("steals");
  const blocks = sum("blocks");
  const turnovers = sum("turnovers");
  const fgm = sum("fgm");
  const fga = sum("fga");
  const tpm = sum("tpm");
  const tpa = sum("tpa");
  const ftm = sum("ftm");
  const fta = sum("fta");

  return {
    gp,
    wins,
    losses: gp - wins,
    winPct: gp > 0 ? (wins / gp) * 100 : 0,
    ppg: gp > 0 ? points / gp : 0,
    rpg: gp > 0 ? rebounds / gp : 0,
    apg: gp > 0 ? assists / gp : 0,
    spg: gp > 0 ? steals / gp : 0,
    bpg: gp > 0 ? blocks / gp : 0,
    topg: gp > 0 ? turnovers / gp : 0,
    fgPct: pct(fgm, fga),
    tpPct: pct(tpm, tpa),
    ftPct: pct(ftm, fta),
    fgm,
    fga,
    tpm,
    tpa,
    ftm,
    fta,
  };
}

export async function getPlayerSeasonStats(playerId: string, seasonId: string): Promise<AggregatedStats> {
  const rows = await prisma.gamePlayerStat.findMany({ where: { playerId, game: { seasonId } } });
  return aggregateRows(rows);
}

export async function getPlayerCareerStats(playerId: string): Promise<AggregatedStats> {
  const rows = await prisma.gamePlayerStat.findMany({ where: { playerId } });
  return aggregateRows(rows);
}

export interface LeaderboardEntry {
  gamertag: string;
  stats: AggregatedStats;
}

function statValue(stats: AggregatedStats, key: StatChoice): number {
  switch (key) {
    case "points":
      return stats.ppg;
    case "rebounds":
      return stats.rpg;
    case "assists":
      return stats.apg;
    case "steals":
      return stats.spg;
    case "blocks":
      return stats.bpg;
    case "turnovers":
      return stats.topg;
    case "winPct":
      return stats.winPct;
    case "fgPct":
      return stats.fgPct;
    case "tpPct":
      return stats.tpPct;
  }
}

export async function getLeaderboard(
  scope: "season" | "career",
  statKey: StatChoice,
  seasonId: string | undefined,
  limit = 10
): Promise<LeaderboardEntry[]> {
  const rows = await prisma.gamePlayerStat.findMany({
    where: scope === "season" ? { game: { seasonId } } : {},
    include: { player: true },
  });

  const byPlayer = new Map<string, { gamertag: string; rows: StatRow[] }>();
  for (const r of rows) {
    const entry = byPlayer.get(r.playerId) ?? { gamertag: r.player.gamertag, rows: [] };
    entry.rows.push(r);
    byPlayer.set(r.playerId, entry);
  }

  const entries: LeaderboardEntry[] = [...byPlayer.values()].map((e) => ({
    gamertag: e.gamertag,
    stats: aggregateRows(e.rows),
  }));

  entries.sort((a, b) => statValue(b.stats, statKey) - statValue(a.stats, statKey));
  return entries.slice(0, limit);
}

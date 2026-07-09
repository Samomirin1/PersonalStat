import { prisma } from "./db";
import type { Player } from "@prisma/client";

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Standard Levenshtein edit distance.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp[rows - 1][cols - 1];
}

// How many character mismatches we tolerate before treating two gamertags as
// different players, scaled to name length so short tags stay strict.
function maxAllowedDistance(len: number): number {
  return Math.min(3, Math.max(1, Math.floor(len * 0.2)));
}

export type MatchType = "exact" | "alias" | "fuzzy" | "new";

export interface PlayerMatch {
  player: Player;
  matchType: MatchType;
  matchedFrom?: string; // the existing name this fuzzy-matched against, if any
}

interface FuzzyHit {
  player: Player;
  distance: number;
  matchedFrom: string;
}

// Read-only: finds the closest existing player/alias, if any is close enough
// to plausibly be the same gamertag. Never writes anything.
async function findBestFuzzyMatch(normalized: string): Promise<FuzzyHit | null> {
  const candidates = await prisma.player.findMany({ include: { aliases: true } });

  let best: FuzzyHit | null = null;
  for (const candidate of candidates) {
    const names = [candidate.gamertag, ...candidate.aliases.map((a) => a.alias)];
    for (const name of names) {
      const dist = editDistance(normalized, normalize(name));
      if (best === null || dist < best.distance) {
        best = { player: candidate, distance: dist, matchedFrom: name };
      }
    }
  }

  return best && best.distance <= maxAllowedDistance(normalized.length) ? best : null;
}

/**
 * Resolves a raw, possibly OCR-mangled gamertag to a Player row, creating
 * one if nothing close enough already exists. Fuzzy hits get remembered as
 * an alias so the same misread resolves instantly next time.
 */
export async function resolvePlayer(rawGamertag: string): Promise<PlayerMatch> {
  const trimmed = rawGamertag.trim();
  const normalized = normalize(trimmed);

  const exact = await prisma.player.findFirst({
    where: { gamertag: { equals: trimmed, mode: "insensitive" } },
  });
  if (exact) return { player: exact, matchType: "exact" };

  const aliasHit = await prisma.playerAlias.findFirst({
    where: { alias: { equals: trimmed, mode: "insensitive" } },
    include: { player: true },
  });
  if (aliasHit) return { player: aliasHit.player, matchType: "alias" };

  const best = await findBestFuzzyMatch(normalized);
  if (best) {
    // Remember this spelling so future exact matches skip fuzzy lookup.
    await prisma.playerAlias
      .create({ data: { alias: trimmed, playerId: best.player.id } })
      .catch(() => undefined); // ignore races / duplicate alias text
    return { player: best.player, matchType: "fuzzy", matchedFrom: best.matchedFrom };
  }

  const created = await prisma.player.create({ data: { gamertag: trimmed } });
  return { player: created, matchType: "new" };
}

export interface MatchPreview {
  gamertag: string;
  matchType: MatchType;
  matchedFrom?: string;
}

/**
 * Same lookup as resolvePlayer, but read-only -- used to warn about likely
 * duplicates/new profiles in a confirmation preview before anything is saved.
 */
export async function previewPlayerMatch(rawGamertag: string): Promise<MatchPreview> {
  const trimmed = rawGamertag.trim();
  const normalized = normalize(trimmed);

  const exact = await prisma.player.findFirst({
    where: { gamertag: { equals: trimmed, mode: "insensitive" } },
  });
  if (exact) return { gamertag: trimmed, matchType: "exact" };

  const aliasHit = await prisma.playerAlias.findFirst({
    where: { alias: { equals: trimmed, mode: "insensitive" } },
  });
  if (aliasHit) return { gamertag: trimmed, matchType: "alias" };

  const best = await findBestFuzzyMatch(normalized);
  if (best) return { gamertag: trimmed, matchType: "fuzzy", matchedFrom: best.matchedFrom };

  return { gamertag: trimmed, matchType: "new" };
}

export async function findPlayerByName(name: string): Promise<Player | null> {
  const trimmed = name.trim();
  const exact = await prisma.player.findFirst({
    where: { gamertag: { equals: trimmed, mode: "insensitive" } },
  });
  if (exact) return exact;

  const aliasHit = await prisma.playerAlias.findFirst({
    where: { alias: { equals: trimmed, mode: "insensitive" } },
    include: { player: true },
  });
  return aliasHit?.player ?? null;
}

export async function searchPlayerNames(query: string, limit = 25): Promise<string[]> {
  const players = await prisma.player.findMany({
    where: { gamertag: { contains: query, mode: "insensitive" } },
    take: limit,
    orderBy: { gamertag: "asc" },
  });
  return players.map((p) => p.gamertag);
}

export interface MergeResult {
  keepGamertag: string;
  duplicateGamertag: string;
  movedGames: number;
}

/**
 * Folds a duplicate profile into the one to keep: every game stat line and
 * alias moves over, and the duplicate's own gamertag becomes an alias of the
 * surviving player so it still resolves correctly next time it's seen.
 */
export async function mergePlayers(keepGamertag: string, duplicateGamertag: string): Promise<MergeResult> {
  const keep = await findPlayerByName(keepGamertag);
  const duplicate = await findPlayerByName(duplicateGamertag);

  if (!keep) throw new Error(`No player found matching "${keepGamertag}".`);
  if (!duplicate) throw new Error(`No player found matching "${duplicateGamertag}".`);
  if (keep.id === duplicate.id) throw new Error("Those two names already point to the same player.");

  const moved = await prisma.gamePlayerStat.updateMany({
    where: { playerId: duplicate.id },
    data: { playerId: keep.id },
  });
  await prisma.playerAlias.updateMany({
    where: { playerId: duplicate.id },
    data: { playerId: keep.id },
  });
  await prisma.playerAlias
    .create({ data: { alias: duplicate.gamertag, playerId: keep.id } })
    .catch(() => undefined);
  await prisma.player.delete({ where: { id: duplicate.id } });

  return { keepGamertag: keep.gamertag, duplicateGamertag: duplicate.gamertag, movedGames: moved.count };
}

/**
 * Permanently removes a player, their aliases, and every recorded game stat
 * line for them (the games themselves, and other players' lines in those
 * games, are untouched). Use when someone leaves and shouldn't be tracked
 * anymore.
 */
export async function deletePlayer(playerId: string): Promise<Player> {
  return prisma.player.delete({ where: { id: playerId } });
}

export async function countPlayerGames(playerId: string): Promise<number> {
  return prisma.gamePlayerStat.count({ where: { playerId } });
}

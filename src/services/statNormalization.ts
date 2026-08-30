import type { ParsedBoxScore, ParsedPlayerRow } from "../types";

const FULL_GAME_QUARTERS = 4;

const COUNTING_FIELDS = [
  "points",
  "rebounds",
  "assists",
  "steals",
  "blocks",
  "fouls",
  "turnovers",
  "fgm",
  "fga",
  "tpm",
  "tpa",
  "ftm",
  "fta",
] as const satisfies readonly (keyof ParsedPlayerRow)[];

export interface NormalizationResult {
  applied: boolean;
  quartersPlayed: number;
  factor: number;
}

/**
 * If a game ended before the 4th quarter (someone quit), scales every
 * player's counting stats up to what a full 24-minute (4x6min quarter)
 * game would project to, so quitting early to dodge a bad stat line
 * doesn't actually help. Mutates parsed in place. Team scores and win/loss
 * are left alone -- only individual counting stats are projected.
 */
export function normalizeParsedBoxScore(parsed: ParsedBoxScore): NormalizationResult {
  const quartersPlayed = Math.min(FULL_GAME_QUARTERS, Math.max(1, Math.round(parsed.quartersPlayed || FULL_GAME_QUARTERS)));
  parsed.quartersPlayed = quartersPlayed; // normalize away any out-of-range/non-integer model output

  if (quartersPlayed >= FULL_GAME_QUARTERS) {
    return { applied: false, quartersPlayed: FULL_GAME_QUARTERS, factor: 1 };
  }

  const factor = FULL_GAME_QUARTERS / quartersPlayed;
  const allPlayers = [...parsed.teamA.players, ...parsed.teamB.players];
  for (const player of allPlayers) {
    for (const field of COUNTING_FIELDS) {
      player[field] = Math.round(player[field] * factor);
    }
  }

  return { applied: true, quartersPlayed, factor };
}

/** User-facing note explaining a normalization, or null if the game went the full 4 quarters. */
export function normalizationNote(quartersPlayed: number): string | null {
  if (quartersPlayed >= FULL_GAME_QUARTERS) return null;
  const factor = FULL_GAME_QUARTERS / quartersPlayed;
  const minutesPlayed = quartersPlayed * 6;
  return `Game ended after Q${quartersPlayed} (${minutesPlayed} min) — counting stats normalized ×${factor.toFixed(2)} to a full 24-minute game. Team score and win/loss reflect the actual outcome.`;
}

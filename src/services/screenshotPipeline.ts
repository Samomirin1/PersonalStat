import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type EmbedBuilder } from "discord.js";
import { parseBoxScore, type ImageInput } from "./visionParser";
import { ensureActiveSeason } from "./statsService";
import { createPendingGame } from "./pendingGames";
import { previewPlayerMatch, type MatchPreview } from "./playerMatcher";
import { buildBoxScorePreviewEmbed } from "../util/embeds";
import type { ParsedBoxScore, ParsedPlayerRow, ParsedTeam } from "../types";

export interface PreviewPayload {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}

export interface ProcessedScreenshot extends PreviewPayload {
  parsed: ParsedBoxScore;
  seasonName: string;
}

async function buildMatchPreviews(parsed: ParsedBoxScore): Promise<Map<string, MatchPreview>> {
  const allPlayers = [...parsed.teamA.players, ...parsed.teamB.players];
  const previews = new Map<string, MatchPreview>();
  for (const p of allPlayers) {
    previews.set(p.gamertag, await previewPlayerMatch(p.gamertag));
  }
  return previews;
}

export async function buildPreviewPayload(token: string, parsed: ParsedBoxScore, seasonName: string): Promise<PreviewPayload> {
  const previews = await buildMatchPreviews(parsed);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`game_save_${token}`).setLabel("Save").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`game_edit_${token}`).setLabel("Edit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`game_discard_${token}`).setLabel("Discard").setStyle(ButtonStyle.Danger)
  );
  return { embed: buildBoxScorePreviewEmbed(parsed, seasonName, previews), components: [row] };
}

/**
 * Parses a box score screenshot, stashes it as a pending confirmation, and
 * builds the preview embed + Save/Edit/Discard buttons.
 */
export async function processScreenshot(
  images: ImageInput[],
  submittedBy: string,
  screenshotUrl?: string
): Promise<ProcessedScreenshot> {
  const parsed = await parseBoxScore(images);
  const season = await ensureActiveSeason();
  const token = createPendingGame({ parsed, seasonId: season.id, seasonName: season.name, submittedBy, screenshotUrl });
  const payload = await buildPreviewPayload(token, parsed, season.name);

  return { parsed, seasonName: season.name, ...payload };
}

type NumericPlayerField = Exclude<keyof ParsedPlayerRow, "gamertag" | "grade">;

const NUMERIC_FIELD_ALIASES: Record<string, NumericPlayerField> = {
  points: "points",
  pts: "points",
  rebounds: "rebounds",
  reb: "rebounds",
  assists: "assists",
  ast: "assists",
  steals: "steals",
  stl: "steals",
  blocks: "blocks",
  blk: "blocks",
  fouls: "fouls",
  turnovers: "turnovers",
  to: "turnovers",
  fgm: "fgm",
  fga: "fga",
  tpm: "tpm",
  "3pm": "tpm",
  tpa: "tpa",
  "3pa": "tpa",
  ftm: "ftm",
  fta: "fta",
};

function applyTeamEdit(team: ParsedTeam, field: string, value: string): string {
  if (field === "name" || field === "teamname") {
    team.name = value;
    return `Updated team name to "${value}".`;
  }
  if (field === "score") {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) throw new Error(`"${value}" isn't a valid score.`);
    team.score = num;
    return `Updated ${team.name}'s score to ${num}.`;
  }
  throw new Error(`Unknown team field "${field}". Try: name, score.`);
}

/**
 * Applies a single field edit to a pending, not-yet-saved box score in
 * place. Throws a user-facing message (safe to show directly) if the row or
 * field can't be resolved.
 */
export function applyEdit(parsed: ParsedBoxScore, rowInput: string, fieldInput: string, valueInput: string): string {
  const row = rowInput.trim();
  const field = fieldInput.trim().toLowerCase();
  const value = valueInput.trim();
  const rowLower = row.toLowerCase();

  if (rowLower === "teama" || rowLower === parsed.teamA.name.toLowerCase()) {
    return applyTeamEdit(parsed.teamA, field, value);
  }
  if (rowLower === "teamb" || rowLower === parsed.teamB.name.toLowerCase()) {
    return applyTeamEdit(parsed.teamB, field, value);
  }

  const allPlayers = [...parsed.teamA.players, ...parsed.teamB.players];
  const player =
    allPlayers.find((p) => p.gamertag.toLowerCase() === rowLower) ??
    allPlayers.find((p) => p.gamertag.toLowerCase().includes(rowLower));
  if (!player) {
    throw new Error(`No player named "${row}" found in this box score. Check the spelling, or use "teamA" / "teamB".`);
  }

  if (field === "gamertag" || field === "name") {
    player.gamertag = value;
    return `Updated gamertag to "${value}".`;
  }
  if (field === "grade") {
    player.grade = value;
    return `Updated ${player.gamertag}'s grade to "${value}".`;
  }

  const numericKey = NUMERIC_FIELD_ALIASES[field];
  if (!numericKey) {
    throw new Error(
      `Unknown field "${field}". Try: gamertag, grade, points, rebounds, assists, steals, blocks, fouls, turnovers, fgm, fga, tpm, tpa, ftm, fta.`
    );
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 0) {
    throw new Error(`"${value}" isn't a valid number for ${field}.`);
  }
  player[numericKey] = num;
  return `Updated ${player.gamertag}'s ${field} to ${num}.`;
}

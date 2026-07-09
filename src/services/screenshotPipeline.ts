import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type EmbedBuilder } from "discord.js";
import { parseBoxScore, type ImageInput } from "./visionParser";
import { ensureActiveSeason } from "./statsService";
import { createPendingGame } from "./pendingGames";
import { previewPlayerMatch, type MatchPreview } from "./playerMatcher";
import { buildBoxScorePreviewEmbed } from "../util/embeds";
import type { ParsedBoxScore } from "../types";

export interface ProcessedScreenshot {
  parsed: ParsedBoxScore;
  seasonName: string;
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}

async function buildMatchPreviews(parsed: ParsedBoxScore): Promise<Map<string, MatchPreview>> {
  const allPlayers = [...parsed.teamA.players, ...parsed.teamB.players];
  const previews = new Map<string, MatchPreview>();
  for (const p of allPlayers) {
    previews.set(p.gamertag, await previewPlayerMatch(p.gamertag));
  }
  return previews;
}

/**
 * Parses a box score screenshot, stashes it as a pending confirmation, and
 * builds the preview embed + Save/Discard buttons. Shared by the passive
 * screenshot listener and the /upload command so both behave identically.
 */
export async function processScreenshot(
  images: ImageInput[],
  submittedBy: string,
  screenshotUrl?: string
): Promise<ProcessedScreenshot> {
  const parsed = await parseBoxScore(images);
  const season = await ensureActiveSeason();
  const previews = await buildMatchPreviews(parsed);

  const token = createPendingGame({ parsed, seasonId: season.id, submittedBy, screenshotUrl });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`game_save_${token}`).setLabel("Save").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`game_discard_${token}`).setLabel("Discard").setStyle(ButtonStyle.Danger)
  );

  return {
    parsed,
    seasonName: season.name,
    embed: buildBoxScorePreviewEmbed(parsed, season.name, previews),
    components: [row],
  };
}

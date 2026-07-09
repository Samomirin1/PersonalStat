import { EmbedBuilder } from "discord.js";
import type { AggregatedStats } from "../services/statsService";
import type { GameWithStats } from "../services/gameService";
import type { MatchPreview } from "../services/playerMatcher";
import type { ParsedBoxScore, ParsedTeam } from "../types";

const BRAND_COLOR = 0xc9082a; // NBA red

function fmtAvg(n: number): string {
  return n.toFixed(1);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function buildStatsEmbed(gamertag: string, subtitle: string, stats: AggregatedStats): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setAuthor({ name: "2K Stat Tracker" })
    .setTitle(gamertag)
    .setDescription(subtitle)
    .addFields(
      { name: "GP", value: String(stats.gp), inline: true },
      { name: "W-L", value: `${stats.wins}-${stats.losses}`, inline: true },
      { name: "Win%", value: fmtPct(stats.winPct), inline: true },
      { name: "PPG", value: fmtAvg(stats.ppg), inline: true },
      { name: "RPG", value: fmtAvg(stats.rpg), inline: true },
      { name: "APG", value: fmtAvg(stats.apg), inline: true },
      { name: "SPG", value: fmtAvg(stats.spg), inline: true },
      { name: "BPG", value: fmtAvg(stats.bpg), inline: true },
      { name: "TOPG", value: fmtAvg(stats.topg), inline: true },
      { name: "FG%", value: fmtPct(stats.fgPct), inline: true },
      { name: "3PT%", value: fmtPct(stats.tpPct), inline: true },
      { name: "FT%", value: fmtPct(stats.ftPct), inline: true },
      { name: "FGM/FGA", value: `${stats.fgm}/${stats.fga}`, inline: true },
      { name: "3PM/3PA", value: `${stats.tpm}/${stats.tpa}`, inline: true },
      { name: "FTM/FTA", value: `${stats.ftm}/${stats.fta}`, inline: true }
    );
}

function matchSuffix(preview: MatchPreview | undefined): string {
  if (!preview) return "";
  if (preview.matchType === "new") return " — 🆕 *new player*";
  if (preview.matchType === "fuzzy") return ` — ⚠️ *looks like existing player* **${preview.matchedFrom}**`;
  return "";
}

function formatTeamLines(team: ParsedTeam, previews: Map<string, MatchPreview>): string {
  const lines = team.players.map((p) => {
    const preview = previews.get(p.gamertag);
    return `\`${p.grade}\` **${p.gamertag}** — ${p.points} PTS / ${p.rebounds} REB / ${p.assists} AST / ${p.steals} STL / ${p.blocks} BLK / ${p.turnovers} TO${matchSuffix(preview)}`;
  });
  return lines.join("\n") || "—";
}

export function buildBoxScorePreviewEmbed(
  parsed: ParsedBoxScore,
  seasonName: string,
  previews: Map<string, MatchPreview>
): EmbedBuilder {
  const hasWarnings = [...previews.values()].some((p) => p.matchType === "fuzzy" || p.matchType === "new");
  const footerNote = hasWarnings
    ? "🆕 = will create a new player. ⚠️ = close match to an existing player, will link automatically — use /removeplayer or /merge after saving if that's wrong."
    : undefined;

  const embed = new EmbedBuilder()
    .setColor(0xc9082a)
    .setTitle("Box score parsed — confirm to save")
    .setDescription(`*${seasonName}*\nDouble check the gamertags and score below before saving.`)
    .addFields(
      { name: `${parsed.teamA.name} — ${parsed.teamA.score}`, value: formatTeamLines(parsed.teamA, previews) },
      { name: `${parsed.teamB.name} — ${parsed.teamB.score}`, value: formatTeamLines(parsed.teamB, previews) }
    );

  if (footerNote) embed.setFooter({ text: footerNote });
  return embed;
}

export function buildGameSummaryEmbed(game: GameWithStats): EmbedBuilder {
  const formatSide = (team: "A" | "B") =>
    game.playerStats
      .filter((s) => s.team === team)
      .map((s) => `\`${s.grade}\` **${s.player.gamertag}** — ${s.points} PTS`)
      .join("\n") || "—";

  return new EmbedBuilder()
    .setColor(0xc9082a)
    .setTitle(`Game #${game.gameNumber}`)
    .setDescription(`<t:${Math.floor(game.playedAt.getTime() / 1000)}:f>`)
    .addFields(
      { name: `${game.teamAName} — ${game.teamAScore}`, value: formatSide("A") },
      { name: `${game.teamBName} — ${game.teamBScore}`, value: formatSide("B") }
    );
}

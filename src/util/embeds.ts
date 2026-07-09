import { EmbedBuilder } from "discord.js";
import type { AggregatedStats } from "../services/statsService";
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

function formatTeamLines(team: ParsedTeam): string {
  const lines = team.players.map(
    (p) =>
      `\`${p.grade}\` **${p.gamertag}** — ${p.points} PTS / ${p.rebounds} REB / ${p.assists} AST / ${p.steals} STL / ${p.blocks} BLK / ${p.turnovers} TO`
  );
  return lines.join("\n") || "—";
}

export function buildBoxScorePreviewEmbed(parsed: ParsedBoxScore, seasonName: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xc9082a)
    .setTitle("Box score parsed — confirm to save")
    .setDescription(`*${seasonName}*\nDouble check the gamertags and score below before saving.`)
    .addFields(
      { name: `${parsed.teamA.name} — ${parsed.teamA.score}`, value: formatTeamLines(parsed.teamA) },
      { name: `${parsed.teamB.name} — ${parsed.teamB.score}`, value: formatTeamLines(parsed.teamB) }
    );
}

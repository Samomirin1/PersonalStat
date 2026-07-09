import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { STAT_CHOICES, type StatChoice } from "../types";
import { getActiveSeason, getLeaderboard, type LeaderboardEntry } from "../services/statsService";

const STAT_LABELS: Record<StatChoice, string> = {
  points: "PPG",
  rebounds: "RPG",
  assists: "APG",
  steals: "SPG",
  blocks: "BPG",
  turnovers: "TOPG",
  winPct: "Win%",
  fgPct: "FG%",
  tpPct: "3PT%",
};

function formatValue(stat: StatChoice, value: number): string {
  return stat === "winPct" || stat === "fgPct" || stat === "tpPct" ? `${value.toFixed(1)}%` : value.toFixed(1);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the top players for a stat")
    .addStringOption((option) =>
      option
        .setName("stat")
        .setDescription("Which stat to rank by")
        .setRequired(true)
        .addChoices(...STAT_CHOICES)
    )
    .addStringOption((option) =>
      option
        .setName("scope")
        .setDescription("Current season or all-time career")
        .addChoices({ name: "Current Season", value: "season" }, { name: "Career", value: "career" })
    )
    .addIntegerOption((option) =>
      option.setName("limit").setDescription("How many players to show (default 10)").setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction) {
    const stat = interaction.options.getString("stat", true) as StatChoice;
    const scope = (interaction.options.getString("scope") ?? "season") as "season" | "career";
    const limit = interaction.options.getInteger("limit") ?? 10;

    let seasonId: string | undefined;
    let scopeLabel = "Career";
    if (scope === "season") {
      const season = await getActiveSeason();
      if (!season) {
        await interaction.reply({ content: "No active season is set up yet.", ephemeral: true });
        return;
      }
      seasonId = season.id;
      scopeLabel = season.name;
    }

    const entries = await getLeaderboard(scope, stat, seasonId, limit);
    if (entries.length === 0) {
      await interaction.reply({ content: "No games recorded yet." });
      return;
    }

    const label = STAT_LABELS[stat];
    const lines = entries.map((entry, i) => {
      const value = formatValue(stat, statValueFor(stat, entry));
      return `**${i + 1}.** ${entry.gamertag} — ${value} ${label}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0xc9082a)
      .setTitle(`${label} Leaderboard`)
      .setDescription(`*${scopeLabel}*\n\n${lines.join("\n")}`);

    await interaction.reply({ embeds: [embed] });
  },
};

function statValueFor(stat: StatChoice, entry: LeaderboardEntry): number {
  switch (stat) {
    case "points":
      return entry.stats.ppg;
    case "rebounds":
      return entry.stats.rpg;
    case "assists":
      return entry.stats.apg;
    case "steals":
      return entry.stats.spg;
    case "blocks":
      return entry.stats.bpg;
    case "turnovers":
      return entry.stats.topg;
    case "winPct":
      return entry.stats.winPct;
    case "fgPct":
      return entry.stats.fgPct;
    case "tpPct":
      return entry.stats.tpPct;
  }
}

export default command;

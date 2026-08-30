import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { STAT_CHOICES, type StatChoice } from "../types";
import {
  getActiveSeason,
  getCurrentEdition,
  getLeaderboard,
  getSeasonByName,
  searchEditions,
  searchSeasonNames,
  type LeaderboardEntry,
} from "../services/statsService";

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
        .setDescription("Current season or career (ignored if 'season' or 'edition' is set)")
        .addChoices({ name: "Current Season", value: "season" }, { name: "Career", value: "career" })
    )
    .addStringOption((option) =>
      option
        .setName("season")
        .setDescription("A specific season to view, e.g. a past one (overrides scope and edition)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("edition")
        .setDescription("A specific game version's career leaderboard, e.g. 2K26 (overrides scope)")
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option.setName("limit").setDescription("How many players to show (default 10)").setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction) {
    const stat = interaction.options.getString("stat", true) as StatChoice;
    const seasonName = interaction.options.getString("season");
    const editionName = interaction.options.getString("edition");
    const scope = (interaction.options.getString("scope") ?? "season") as "season" | "career";
    const limit = interaction.options.getInteger("limit") ?? 10;

    let seasonId: string | undefined;
    let edition: string | undefined;
    let scopeLabel: string;

    if (seasonName) {
      const season = await getSeasonByName(seasonName);
      if (!season) {
        await interaction.reply({
          content: `No season named "${seasonName}" found. Use /season list to see available seasons.`,
          ephemeral: true,
        });
        return;
      }
      seasonId = season.id;
      scopeLabel = season.name;
    } else if (editionName) {
      edition = editionName;
      scopeLabel = `Career — ${editionName}`;
    } else if (scope === "season") {
      const season = await getActiveSeason();
      if (!season) {
        await interaction.reply({ content: "No active season is set up yet.", ephemeral: true });
        return;
      }
      seasonId = season.id;
      scopeLabel = season.name;
    } else {
      edition = (await getCurrentEdition()) ?? undefined;
      scopeLabel = edition ? `Career — ${edition}` : "Career";
    }

    const entries = await getLeaderboard(seasonId ? "season" : "career", stat, seasonId, limit, edition);
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

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "edition") {
      const matches = await searchEditions(focused.value);
      await interaction.respond(matches.map((name) => ({ name, value: name })));
      return;
    }
    const matches = await searchSeasonNames(focused.value);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
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

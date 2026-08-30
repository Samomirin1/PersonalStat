import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { findPlayerByName, searchPlayerNames } from "../services/playerMatcher";
import { getActiveSeason, getPlayerSeasonStats, getSeasonByName, searchSeasonNames } from "../services/statsService";
import { buildStatsEmbed } from "../util/embeds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show a player's season stats")
    .addStringOption((option) =>
      option
        .setName("gamertag")
        .setDescription("The player's gamertag")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("season")
        .setDescription("Which season to view (defaults to the current season)")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const gamertag = interaction.options.getString("gamertag", true);
    const seasonName = interaction.options.getString("season");

    const player = await findPlayerByName(gamertag);
    if (!player) {
      await interaction.reply({ content: `No player found matching "${gamertag}".`, ephemeral: true });
      return;
    }

    const season = seasonName ? await getSeasonByName(seasonName) : await getActiveSeason();
    if (!season) {
      await interaction.reply({
        content: seasonName
          ? `No season named "${seasonName}" found. Use /season list to see available seasons.`
          : "No active season is set up yet.",
        ephemeral: true,
      });
      return;
    }

    const stats = await getPlayerSeasonStats(player.id, season.id);
    if (stats.gp === 0) {
      await interaction.reply({ content: `${player.gamertag} has no recorded games in ${season.name} yet.` });
      return;
    }

    await interaction.reply({ embeds: [buildStatsEmbed(player.gamertag, season.name, stats)] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "season") {
      const matches = await searchSeasonNames(focused.value);
      await interaction.respond(matches.map((name) => ({ name, value: name })));
      return;
    }
    const matches = await searchPlayerNames(focused.value);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },
};

export default command;

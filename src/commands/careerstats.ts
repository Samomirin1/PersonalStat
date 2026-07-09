import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { findPlayerByName, searchPlayerNames } from "../services/playerMatcher";
import { getPlayerCareerStats } from "../services/statsService";
import { buildStatsEmbed } from "../util/embeds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("careerstats")
    .setDescription("Show a player's all-time career stats")
    .addStringOption((option) =>
      option
        .setName("gamertag")
        .setDescription("The player's gamertag")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const gamertag = interaction.options.getString("gamertag", true);

    const player = await findPlayerByName(gamertag);
    if (!player) {
      await interaction.reply({ content: `No player found matching "${gamertag}".`, ephemeral: true });
      return;
    }

    const stats = await getPlayerCareerStats(player.id);
    if (stats.gp === 0) {
      await interaction.reply({ content: `${player.gamertag} has no recorded games yet.` });
      return;
    }

    await interaction.reply({ embeds: [buildStatsEmbed(player.gamertag, "Career", stats)] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = await searchPlayerNames(focused);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },
};

export default command;

import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { findPlayerByName, searchPlayerNames } from "../services/playerMatcher";
import { getCurrentEdition, getPlayerCareerStats, searchEditions } from "../services/statsService";
import { buildStatsEmbed } from "../util/embeds";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("careerstats")
    .setDescription("Show a player's career stats")
    .addStringOption((option) =>
      option
        .setName("gamertag")
        .setDescription("The player's gamertag")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("edition")
        .setDescription("Game version to view (defaults to the current one, e.g. 2K27)")
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    const gamertag = interaction.options.getString("gamertag", true);
    const edition = interaction.options.getString("edition") ?? (await getCurrentEdition()) ?? undefined;

    const player = await findPlayerByName(gamertag);
    if (!player) {
      await interaction.reply({ content: `No player found matching "${gamertag}".`, ephemeral: true });
      return;
    }

    const stats = await getPlayerCareerStats(player.id, edition);
    if (stats.gp === 0) {
      const scope = edition ? `${edition} career` : "career";
      await interaction.reply({ content: `${player.gamertag} has no recorded games for their ${scope} yet.` });
      return;
    }

    const subtitle = edition ? `Career — ${edition}` : "Career";
    await interaction.reply({ embeds: [buildStatsEmbed(player.gamertag, subtitle, stats)] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === "edition") {
      const matches = await searchEditions(focused.value);
      await interaction.respond(matches.map((name) => ({ name, value: name })));
      return;
    }
    const matches = await searchPlayerNames(focused.value);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },
};

export default command;

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { Command } from "../types";
import { getGameByNumber } from "../services/gameService";
import { buildGameSummaryEmbed } from "../util/embeds";
import { isAdmin } from "../util/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("deletegame")
    .setDescription("Delete a game and all its stats (admin)")
    .addIntegerOption((option) =>
      option.setName("game_number").setDescription("The game's number, from /games").setRequired(true)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member as GuildMember | null)) {
      await interaction.reply({
        content: "You need the Manage Server permission (or the configured admin role) to use /deletegame.",
        ephemeral: true,
      });
      return;
    }

    const gameNumber = interaction.options.getInteger("game_number", true);
    const game = await getGameByNumber(gameNumber);
    if (!game) {
      await interaction.reply({ content: `No game #${gameNumber} found.`, ephemeral: true });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`deletegame_confirm_${gameNumber}`)
        .setLabel("Delete Game")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`deletegame_cancel_${gameNumber}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      content: "Delete this game? This removes it and every player's stat line from it — can't be undone.",
      embeds: [buildGameSummaryEmbed(game)],
      components: [row],
    });
  },
};

export default command;

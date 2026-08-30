import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { Command } from "../types";
import { countPlayerGames, findPlayerByName, searchPlayerNames } from "../services/playerMatcher";
import { isAdmin } from "../util/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("removeplayer")
    .setDescription("Permanently remove a player and their stats from the tracker (admin)")
    .addStringOption((option) =>
      option
        .setName("gamertag")
        .setDescription("The player to remove")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member as GuildMember | null)) {
      await interaction.reply({
        content: "You need the Manage Server permission (or the configured admin role) to use /removeplayer.",
        ephemeral: true,
      });
      return;
    }

    const gamertag = interaction.options.getString("gamertag", true);
    const player = await findPlayerByName(gamertag);
    if (!player) {
      await interaction.reply({ content: `No player found matching "${gamertag}".`, ephemeral: true });
      return;
    }

    const gameCount = await countPlayerGames(player.id);

    const embed = new EmbedBuilder()
      .setColor(0xc9082a)
      .setTitle(`Remove ${player.gamertag}?`)
      .setDescription(
        `This deletes **${player.gamertag}** and their ${gameCount} recorded game stat line(s). The games themselves and other players' stats in them are unaffected. This can't be undone.`
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`removeplayer_confirm_${player.id}`)
        .setLabel("Remove Player")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`removeplayer_cancel_${player.id}`).setLabel("Cancel").setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = await searchPlayerNames(focused);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },
};

export default command;

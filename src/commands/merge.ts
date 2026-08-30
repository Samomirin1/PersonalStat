import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { mergePlayers, searchPlayerNames } from "../services/playerMatcher";
import { isAdmin } from "../util/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("merge")
    .setDescription("Merge a duplicate player profile into the one to keep")
    .addStringOption((option) =>
      option.setName("keep").setDescription("The profile to keep").setRequired(true).setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("duplicate")
        .setDescription("The duplicate profile to fold into it")
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async execute(interaction) {
    if (!isAdmin(interaction.member as import("discord.js").GuildMember | null)) {
      await interaction.reply({
        content: "You need the Manage Server permission (or the configured admin role) to use /merge.",
        ephemeral: true,
      });
      return;
    }

    const keep = interaction.options.getString("keep", true);
    const duplicate = interaction.options.getString("duplicate", true);

    try {
      const result = await mergePlayers(keep, duplicate);
      await interaction.reply(
        `Merged **${result.duplicateGamertag}** into **${result.keepGamertag}** — moved ${result.movedGames} game stat line(s). "${result.duplicateGamertag}" will now resolve to ${result.keepGamertag}.`
      );
    } catch (err) {
      await interaction.reply({ content: err instanceof Error ? err.message : "Merge failed.", ephemeral: true });
    }
  },

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();
    const matches = await searchPlayerNames(focused);
    await interaction.respond(matches.map((name) => ({ name, value: name })));
  },
};

export default command;

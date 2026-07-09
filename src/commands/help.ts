import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";

const command: Command = {
  data: new SlashCommandBuilder().setName("help").setDescription("List what the 2K Stat Tracker bot can do"),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0xc9082a)
      .setTitle("2K Stat Tracker")
      .setDescription(
        [
          "Post a Team Up **GAME STATS** box score screenshot in the stats channel and I'll parse it automatically.",
          "",
          "**/stats gamertag** — current season stats",
          "**/careerstats gamertag** — all-time career stats",
          "**/leaderboard stat [scope] [limit]** — top players by a stat",
          "**/season new|list|current** — manage seasons (admin)",
          "**/merge keep duplicate** — fold a duplicate profile into another (admin)",
        ].join("\n")
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;

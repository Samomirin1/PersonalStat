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
          "Use **/upload** with a Team Up **GAME STATS** box score screenshot to add a game.",
          "",
          "**/upload screenshot [screenshot2]** — upload a box score screenshot; I'll show you the parsed stats with Save / Edit / Discard buttons before anything is stored (admin)",
          "**/stats gamertag** — current season stats",
          "**/careerstats gamertag** — all-time career stats",
          "**/leaderboard stat [scope] [limit]** — top players by a stat",
          "**/games [limit]** — list recent games and their numbers",
          "**/season new|list|current** — manage seasons (admin)",
          "**/merge keep duplicate** — fold a duplicate profile into another (admin)",
          "**/removeplayer gamertag** — permanently remove a player and their stats (admin)",
          "**/deletegame game_number** — delete a game and its stats (admin)",
        ].join("\n")
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;

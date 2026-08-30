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
          "**/stats gamertag [season]** — season stats; defaults to the current season",
          "**/careerstats gamertag [edition]** — career stats for the current game version, or pick a past one",
          "**/2k26stats gamertag** — archived career stats from the 2K26 era",
          "**/leaderboard stat [scope] [season] [edition] [limit]** — top players by a stat",
          "**/games [limit]** — list recent games and their numbers",
          "**/season new|list|current** — manage seasons; \`new\` takes an optional \`edition\` when switching game versions (admin)",
          "**/merge keep duplicate** — fold a duplicate profile into another (admin)",
          "**/removeplayer gamertag** — permanently remove a player and their stats (admin)",
          "**/deletegame game_number** — delete a game and its stats (admin)",
        ].join("\n")
      );
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;

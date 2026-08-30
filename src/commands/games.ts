import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { getRecentGames } from "../services/gameService";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("games")
    .setDescription("List recent games")
    .addIntegerOption((option) =>
      option.setName("limit").setDescription("How many to show (default 10)").setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger("limit") ?? 10;
    const games = await getRecentGames(limit);

    if (games.length === 0) {
      await interaction.reply("No games recorded yet.");
      return;
    }

    const lines = games.map((g) => {
      const timestamp = Math.floor(g.playedAt.getTime() / 1000);
      const normTag = g.quartersPlayed < 4 ? ` ⚠️ Q${g.quartersPlayed} (normalized)` : "";
      return `**#${g.gameNumber}** — ${g.teamAName} ${g.teamAScore} @ ${g.teamBName} ${g.teamBScore} · <t:${timestamp}:R>${normTag}`;
    });

    const embed = new EmbedBuilder().setColor(0xc9082a).setTitle("Recent Games").setDescription(lines.join("\n"));
    await interaction.reply({ embeds: [embed] });
  },
};

export default command;

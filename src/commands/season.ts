import { EmbedBuilder, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { Command } from "../types";
import { getActiveSeason, startNewSeason } from "../services/statsService";
import { prisma } from "../services/db";
import { isAdmin } from "../util/permissions";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("season")
    .setDescription("Manage stat-tracking seasons")
    .addSubcommand((sub) =>
      sub
        .setName("new")
        .setDescription("End the current season and start a new one")
        .addStringOption((option) => option.setName("name").setDescription("Name for the new season").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("List all seasons"))
    .addSubcommand((sub) => sub.setName("current").setDescription("Show the active season")),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "new") {
      if (!isAdmin(interaction.member as GuildMember | null)) {
        await interaction.reply({
          content: "You need the Manage Server permission (or the configured admin role) to start a new season.",
          ephemeral: true,
        });
        return;
      }
      const name = interaction.options.getString("name", true);
      const season = await startNewSeason(name);
      await interaction.reply(`Started a new season: **${season.name}**. All new games will be tracked under it.`);
      return;
    }

    if (sub === "current") {
      const season = await getActiveSeason();
      await interaction.reply(season ? `Active season: **${season.name}**` : "No active season yet.");
      return;
    }

    if (sub === "list") {
      const seasons = await prisma.season.findMany({ orderBy: { startedAt: "desc" } });
      if (seasons.length === 0) {
        await interaction.reply("No seasons yet.");
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0xc9082a)
        .setTitle("Seasons")
        .setDescription(seasons.map((s) => `${s.isActive ? "🟢" : "⚪"} **${s.name}**`).join("\n"));
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export default command;

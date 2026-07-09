import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../types";
import { fetchImageAsBase64 } from "../services/visionParser";
import { processScreenshot } from "../services/screenshotPipeline";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("upload")
    .setDescription("Upload a box score screenshot")
    .addAttachmentOption((option) =>
      option.setName("screenshot").setDescription("The GAME STATS screenshot").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option
        .setName("screenshot2")
        .setDescription("A second screenshot, if the box score didn't fit in one image")
        .setRequired(false)
    ),

  async execute(interaction) {
    const first = interaction.options.getAttachment("screenshot", true);
    const second = interaction.options.getAttachment("screenshot2");
    const attachments = second ? [first, second] : [first];

    const nonImage = attachments.find((a) => !a.contentType?.startsWith("image/"));
    if (nonImage) {
      await interaction.reply({ content: `"${nonImage.name}" doesn't look like an image.`, ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const downloaded = await Promise.all(attachments.map((a) => fetchImageAsBase64(a.url)));
      const result = await processScreenshot(downloaded, interaction.user.id, first.url);
      await interaction.editReply({ embeds: [result.embed], components: result.components });
    } catch (err) {
      console.error("Failed to parse box score:", err);
      await interaction.editReply(
        `Couldn't read that box score (${err instanceof Error ? err.message : "unknown error"}). Try a clearer screenshot.`
      );
    }
  },
};

export default command;

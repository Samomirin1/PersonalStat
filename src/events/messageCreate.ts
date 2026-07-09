import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, Events, type Message } from "discord.js";
import { fetchImageAsBase64, parseBoxScore } from "../services/visionParser";
import { ensureActiveSeason } from "../services/statsService";
import { createPendingGame } from "../services/pendingGames";
import { buildBoxScorePreviewEmbed } from "../util/embeds";

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot) return;

  const screenshotChannelId = process.env.SCREENSHOT_CHANNEL_ID;
  const isDM = message.channel.type === ChannelType.DM;
  if (screenshotChannelId && message.channelId !== screenshotChannelId && !isDM) return;

  const images = message.attachments.filter((a) => a.contentType?.startsWith("image/"));
  if (images.size === 0) return;

  const statusMsg = await message.reply("📸 Reading box score...");

  try {
    const downloaded = await Promise.all(images.map((a) => fetchImageAsBase64(a.url)));
    const parsed = await parseBoxScore(downloaded);
    const season = await ensureActiveSeason();

    const token = createPendingGame({
      parsed,
      seasonId: season.id,
      submittedBy: message.author.id,
      screenshotUrl: images.first()?.url,
    });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`game_save_${token}`).setLabel("Save").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`game_discard_${token}`).setLabel("Discard").setStyle(ButtonStyle.Danger)
    );

    await statusMsg.edit({
      content: "",
      embeds: [buildBoxScorePreviewEmbed(parsed, season.name)],
      components: [row],
    });
  } catch (err) {
    console.error("Failed to parse box score:", err);
    await statusMsg.edit(
      `Couldn't read that box score (${err instanceof Error ? err.message : "unknown error"}). Try a clearer screenshot.`
    );
  }
}

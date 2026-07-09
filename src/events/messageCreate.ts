import { ChannelType, Events, type Message } from "discord.js";
import { fetchImageAsBase64 } from "../services/visionParser";
import { processScreenshot } from "../services/screenshotPipeline";

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
    const result = await processScreenshot(downloaded, message.author.id, images.first()?.url);
    await statusMsg.edit({ content: "", embeds: [result.embed], components: result.components });
  } catch (err) {
    console.error("Failed to parse box score:", err);
    await statusMsg.edit(
      `Couldn't read that box score (${err instanceof Error ? err.message : "unknown error"}). Try a clearer screenshot.`
    );
  }
}

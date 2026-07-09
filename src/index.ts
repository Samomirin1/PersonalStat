import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { loadCommands } from "./commandLoader";
import { ensureActiveSeason } from "./services/statsService";
import * as messageCreate from "./events/messageCreate";
import { makeHandler as makeInteractionHandler } from "./events/interactionCreate";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN is not set.");

  const commands = await loadCommands();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once("ready", async (readyClient) => {
    await ensureActiveSeason();
    console.log(`2K Stat Tracker logged in as ${readyClient.user.tag}`);
  });

  client.on(messageCreate.name, messageCreate.execute);
  client.on("interactionCreate", makeInteractionHandler(commands));

  await client.login(token);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

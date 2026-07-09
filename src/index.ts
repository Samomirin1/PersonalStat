import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { loadCommands } from "./commandLoader";
import { registerCommands } from "./registerCommands";
import { ensureActiveSeason } from "./services/statsService";
import { makeHandler as makeInteractionHandler } from "./events/interactionCreate";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN is not set.");

  const commands = await loadCommands();

  // Re-registering on every boot keeps Discord's command list in sync with
  // the deployed code without a separate manual `deploy-commands` step.
  try {
    await registerCommands(commands);
  } catch (err) {
    console.error("Failed to register slash commands (bot will still start):", err);
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once("ready", async (readyClient) => {
    await ensureActiveSeason();
    console.log(`2K Stat Tracker logged in as ${readyClient.user.tag}`);
  });

  client.on("interactionCreate", makeInteractionHandler(commands));

  await client.login(token);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

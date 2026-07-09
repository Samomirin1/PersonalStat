import "dotenv/config";
import { REST, Routes } from "discord.js";
import { loadCommands } from "./commandLoader";

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId) {
    throw new Error("DISCORD_TOKEN and DISCORD_CLIENT_ID must be set.");
  }

  const commands = await loadCommands();
  const body = [...commands.values()].map((c) => c.data.toJSON());

  const rest = new REST().setToken(token);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Registered ${body.length} guild command(s) to guild ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log(`Registered ${body.length} global command(s). These can take up to an hour to propagate.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { loadCommands } from "./commandLoader";
import { registerCommands } from "./registerCommands";

async function main() {
  const commands = await loadCommands();
  await registerCommands(commands);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

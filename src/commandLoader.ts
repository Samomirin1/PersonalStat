import path from "node:path";
import fs from "node:fs";
import type { Command } from "./types";

export async function loadCommands(): Promise<Map<string, Command>> {
  const commands = new Map<string, Command>();
  const dir = path.join(__dirname, "commands");

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
    const mod = await import(path.join(dir, file));
    const command: Command = mod.default;
    commands.set(command.data.name, command);
  }

  return commands;
}

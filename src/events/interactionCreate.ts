import { Events, type ButtonInteraction, type GuildMember, type Interaction } from "discord.js";
import type { Command } from "../types";
import { clearPendingGame, getPendingGame } from "../services/pendingGames";
import { saveParsedGame } from "../services/gameService";
import { isAdmin } from "../util/permissions";

export const name = Events.InteractionCreate;

export function makeHandler(commands: Map<string, Command>) {
  return async (interaction: Interaction): Promise<void> => {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error running /${interaction.commandName}:`, err);
        const payload = { content: "Something went wrong running that command.", ephemeral: true };
        if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
      }
      return;
    }

    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`Error in autocomplete for /${interaction.commandName}:`, err);
      }
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("game_")) {
      await handleGameConfirmationButton(interaction);
    }
  };
}

async function handleGameConfirmationButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, token] = interaction.customId.split("_");
  if (!token) return;

  const pending = getPendingGame(token);
  if (!pending) {
    await interaction.reply({ content: "This confirmation has expired. Please repost the screenshot.", ephemeral: true });
    return;
  }

  const isOwner = interaction.user.id === pending.submittedBy;
  const admin = isAdmin(interaction.member as GuildMember | null);
  if (!isOwner && !admin) {
    await interaction.reply({
      content: "Only the person who posted this screenshot (or an admin) can confirm it.",
      ephemeral: true,
    });
    return;
  }

  if (action === "discard") {
    clearPendingGame(token);
    await interaction.update({ content: "❌ Discarded.", embeds: [], components: [] });
    return;
  }

  if (action === "save") {
    await interaction.deferUpdate();
    clearPendingGame(token);

    try {
      const result = await saveParsedGame(pending.parsed, pending.seasonId, pending.submittedBy, pending.screenshotUrl);
      const newPlayers = result.matches.filter((m) => m.matchType === "new").map((m) => m.gamertag);
      const fuzzyMatches = result.matches.filter((m) => m.matchType === "fuzzy");

      const notes: string[] = ["✅ Saved."];
      if (newPlayers.length) notes.push(`New player(s) created: ${newPlayers.join(", ")}`);
      for (const m of fuzzyMatches) {
        notes.push(`Matched "${m.gamertag}" to existing player "${m.matchedFrom}" — use /merge if that's wrong.`);
      }

      await interaction.editReply({ content: notes.join("\n"), embeds: [], components: [] });
    } catch (err) {
      console.error("Failed to save game:", err);
      await interaction.editReply({ content: "Something went wrong saving that game.", embeds: [], components: [] });
    }
  }
}

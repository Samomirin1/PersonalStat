import {
  ActionRowBuilder,
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type GuildMember,
  type Interaction,
  type ModalSubmitInteraction,
} from "discord.js";
import type { Command } from "../types";
import { clearPendingGame, getPendingGame } from "../services/pendingGames";
import { deleteGameByNumber, saveParsedGame } from "../services/gameService";
import { deletePlayer } from "../services/playerMatcher";
import { applyEdit, buildPreviewPayload } from "../services/screenshotPipeline";
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
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("deletegame_")) {
      await handleDeleteGameButton(interaction);
      return;
    }

    if (interaction.isButton() && interaction.customId.startsWith("removeplayer_")) {
      await handleRemovePlayerButton(interaction);
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("game_editmodal_")) {
      await handleEditModalSubmit(interaction);
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

  if (action === "edit") {
    const modal = new ModalBuilder().setCustomId(`game_editmodal_${token}`).setTitle("Edit a stat");
    const rowInput = new TextInputBuilder()
      .setCustomId("row")
      .setLabel("Player gamertag (or teamA / teamB)")
      .setPlaceholder("e.g. tahjmoney_ or teamA")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const fieldInput = new TextInputBuilder()
      .setCustomId("field")
      .setLabel("Field to change")
      .setPlaceholder("gamertag, grade, points, fgm, fga, tpm, tpa, score, ...")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);
    const valueInput = new TextInputBuilder()
      .setCustomId("value")
      .setLabel("New value")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(rowInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(fieldInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(valueInput)
    );

    await interaction.showModal(modal);
    return;
  }

  if (action === "save") {
    await interaction.deferUpdate();
    clearPendingGame(token);

    try {
      const result = await saveParsedGame(pending.parsed, pending.seasonId, pending.submittedBy, pending.screenshotUrl);
      const newPlayers = result.matches.filter((m) => m.matchType === "new").map((m) => m.gamertag);
      const fuzzyMatches = result.matches.filter((m) => m.matchType === "fuzzy");

      const notes: string[] = [`✅ Saved as Game #${result.gameNumber}.`];
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

async function handleDeleteGameButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, numberStr] = interaction.customId.split("_");
  const gameNumber = Number(numberStr);
  if (!Number.isFinite(gameNumber)) return;

  if (!isAdmin(interaction.member as GuildMember | null)) {
    await interaction.reply({ content: "Admin only.", ephemeral: true });
    return;
  }

  if (action === "cancel") {
    await interaction.update({ content: "Cancelled.", embeds: [], components: [] });
    return;
  }

  if (action === "confirm") {
    try {
      await deleteGameByNumber(gameNumber);
      await interaction.update({ content: `🗑️ Deleted game #${gameNumber}.`, embeds: [], components: [] });
    } catch (err) {
      console.error("Failed to delete game:", err);
      await interaction.update({ content: `Couldn't delete game #${gameNumber}.`, embeds: [], components: [] });
    }
  }
}

async function handleRemovePlayerButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, playerId] = interaction.customId.split("_");
  if (!playerId) return;

  if (!isAdmin(interaction.member as GuildMember | null)) {
    await interaction.reply({ content: "Admin only.", ephemeral: true });
    return;
  }

  if (action === "cancel") {
    await interaction.update({ content: "Cancelled.", embeds: [], components: [] });
    return;
  }

  if (action === "confirm") {
    try {
      const removed = await deletePlayer(playerId);
      await interaction.update({ content: `🗑️ Removed **${removed.gamertag}** from the tracker.`, embeds: [], components: [] });
    } catch (err) {
      console.error("Failed to remove player:", err);
      await interaction.update({ content: "Couldn't remove that player.", embeds: [], components: [] });
    }
  }
}

async function handleEditModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const token = interaction.customId.replace("game_editmodal_", "");

  const pending = getPendingGame(token);
  if (!pending) {
    await interaction.reply({ content: "This confirmation has expired. Please repost the screenshot.", ephemeral: true });
    return;
  }

  const isOwner = interaction.user.id === pending.submittedBy;
  const admin = isAdmin(interaction.member as GuildMember | null);
  if (!isOwner && !admin) {
    await interaction.reply({
      content: "Only the person who posted this screenshot (or an admin) can edit it.",
      ephemeral: true,
    });
    return;
  }

  const row = interaction.fields.getTextInputValue("row");
  const field = interaction.fields.getTextInputValue("field");
  const value = interaction.fields.getTextInputValue("value");

  try {
    const note = applyEdit(pending.parsed, row, field, value);
    const payload = await buildPreviewPayload(token, pending.parsed, pending.seasonName);
    if (interaction.isFromMessage()) {
      await interaction.update({ content: `✏️ ${note}`, embeds: [payload.embed], components: payload.components });
    } else {
      await interaction.reply({ content: `✏️ ${note}`, embeds: [payload.embed], components: payload.components });
    }
  } catch (err) {
    await interaction.reply({
      content: err instanceof Error ? err.message : "Couldn't apply that edit.",
      ephemeral: true,
    });
  }
}

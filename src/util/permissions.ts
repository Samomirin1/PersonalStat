import { PermissionFlagsBits, type GuildMember } from "discord.js";

export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;

  const adminRoleId = process.env.ADMIN_ROLE_ID;
  if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;

  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

// Anyone allowed to submit games: admins, plus an optional separate role
// (e.g. "Lobby Leader") that can upload without needing full admin rights.
export function canUpload(member: GuildMember | null): boolean {
  if (!member) return false;
  if (isAdmin(member)) return true;

  const uploadRoleId = process.env.UPLOAD_ROLE_ID;
  return !!uploadRoleId && member.roles.cache.has(uploadRoleId);
}

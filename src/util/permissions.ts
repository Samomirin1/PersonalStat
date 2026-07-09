import { PermissionFlagsBits, type GuildMember } from "discord.js";

export function isAdmin(member: GuildMember | null): boolean {
  if (!member) return false;

  const adminRoleId = process.env.ADMIN_ROLE_ID;
  if (adminRoleId && member.roles.cache.has(adminRoleId)) return true;

  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

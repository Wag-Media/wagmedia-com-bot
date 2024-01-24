import { Guild, User } from "discord.js";

export const userHasRole = (
  guild: Guild,
  user: User,
  roles: string[]
): boolean => {
  if (!guild) return false; // Ignore DMs

  // Get the member object from the user ID
  const member = guild.members.cache.get(user.id);

  // Check if the member object is found
  if (!member) return false;

  // Check if the user has the role
  const hasRole = member.roles.cache.some((role) => roles.includes(role.name));

  return hasRole;
};

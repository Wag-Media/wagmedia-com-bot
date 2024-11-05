import { Guild, User } from "discord.js";

export const userHasRole = async (
  guild: Guild,
  user: User,
  roles: string[],
): Promise<boolean> => {
  if (!guild) return false; // Ignore DMs

  // Get the member object from the user ID
  const member = await guild.members.fetch(user.id);

  // Check if the member object is found
  if (!member) return false;

  // Check if the user has the role
  const hasRole = member.roles.cache.some((role) => roles.includes(role.name));

  return hasRole;
};

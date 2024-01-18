import { ensureFullEntities } from "@/handlers/util";
import { PrismaClient } from "@prisma/client";
import { Message, MessageReaction, PartialMessage, User } from "discord.js";
const prisma = new PrismaClient();

export const findOrCreateUser = async (
  message: Message<boolean> | PartialMessage
) => {
  if (!message.author) {
    throw new Error("Message must have a member");
  }

  const user = await prisma.user.upsert({
    where: {
      discordId: message.author.id,
    },
    update: {
      // Update the avatar every time the user posts something
      avatar: message.member?.displayAvatarURL(),
      name: message.member?.displayName,
    },
    create: {
      discordId: message.author.id,
      avatar: message.member?.displayAvatarURL(),
      name: message.member?.displayName,
    },
  });
  return user;
};

export const findOrCreateUserFromReaction = async (
  reaction: MessageReaction
) => {
  let user: User | undefined;

  try {
    if (!reaction.message.author) {
      throw new Error("Message must have a member");
    }

    // Check if the users who reacted are fully cached
    if (!reaction.users.cache.has(reaction.message.author.id)) {
      // If not, fetch them
      await reaction.users.fetch();
    }

    // Now, the cache is up-to-date
    user = reaction.users.cache.last();

    if (!user) {
      throw new Error("No user found in reaction");
    }
  } catch (error) {
    // Handle any errors that occurred during fetching
    console.error("Failed to fetch users from reaction:", error);
    throw error; // Re-throw the error if you want the calling function to handle it
  }

  console.log("will try to upsert user", user.id);

  const dbUser = await prisma.user.upsert({
    where: {
      discordId: user.id,
    },
    update: {
      // Update the avatar every time the user posts something
      avatar: user?.displayAvatarURL(),
      name: user?.displayName,
    },
    create: {
      discordId: user.id,
      avatar: user?.displayAvatarURL(),
      name: user?.displayName,
    },
  });
  return dbUser;
};

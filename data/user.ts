import { PrismaClient } from "@prisma/client";
import { Message, PartialMessage } from "discord.js";
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

import { PrismaClient } from "@prisma/client";
import {
  Message,
  MessageReaction,
  PartialMessage,
  User as DiscordUser,
} from "discord.js";
const prisma = new PrismaClient();

export const findOrCreateUser = async (
  message: Message<boolean> | PartialMessage,
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

export const findOrCreateUserFromDiscordUser = async (user: DiscordUser) => {
  const dbUser = await prisma.user.upsert({
    where: {
      discordId: user.id,
    },
    update: {
      // Update the avatar every time the user posts something
      avatar: user?.displayAvatarURL(),
      avatarDecoration: user.avatarDecorationURL(),
      banner: user?.bannerURL(),
      accentColor: user?.hexAccentColor,
      name: user?.displayName,
    },
    create: {
      discordId: user.id,
      avatar: user?.displayAvatarURL(),
      avatarDecoration: user.avatarDecorationURL(),
      banner: user?.bannerURL(),
      accentColor: user?.hexAccentColor,
      name: user?.displayName,
    },
  });
  return dbUser;
};

export const findUserById = async (userId: string) => {
  const dbUser = await prisma.user.findUnique({
    where: {
      discordId: userId,
    },
  });
  return dbUser;
};

export const findOrCreateUserById = async (userId: string) => {
  const dbUser = await prisma.user.upsert({
    where: {
      discordId: userId,
    },
    update: {},
    create: {
      discordId: userId,
    },
  });
  return dbUser;
};

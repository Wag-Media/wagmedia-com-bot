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

  const roles = message.member?.roles.cache.map((role) => role.name);

  const user = await prisma.user.upsert({
    where: {
      discordId: message.author.id,
    },
    update: {
      // Update the avatar every time the user posts something
      avatar: message.member?.displayAvatarURL(),
      avatarDecoration: message.author.avatarDecorationURL(),
      banner: message.author.bannerURL(),
      accentColor: message.author.hexAccentColor,
      name: message.member?.displayName,
      roles,
    },
    create: {
      discordId: message.author.id,
      avatar: message.member?.displayAvatarURL(),
      name: message.member?.displayName,
      roles: [],
    },
  });
  return user;
};

export const findOrCreateUserFromDiscordUser = async (user: DiscordUser) => {
  const fullUser = await user.fetch(true);

  const dbUser = await prisma.user.upsert({
    where: {
      discordId: fullUser.id,
    },
    update: {
      // Update the avatar every time the fullUser posts something
      avatar: fullUser?.displayAvatarURL(),
      avatarDecoration: fullUser.avatarDecorationURL(),
      banner: fullUser?.bannerURL(),
      accentColor: fullUser?.hexAccentColor,
      name: fullUser?.displayName,
    },
    create: {
      discordId: fullUser.id,
      avatar: fullUser?.displayAvatarURL(),
      avatarDecoration: fullUser.avatarDecorationURL(),
      banner: fullUser?.bannerURL(),
      accentColor: fullUser?.hexAccentColor,
      name: fullUser?.displayName,
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

export const updateUserBio = async (userId: string, bio: string) => {
  const dbUser = await prisma.user.update({
    where: { discordId: userId },
    data: { bio },
  });
  return dbUser;
};

export const updateUserTwitter = async (userId: string, twitter: string) => {
  const dbUser = await prisma.user.update({
    where: { discordId: userId },
    data: { twitterUsername: twitter },
  });
  return dbUser;
};

export const updateUserDomain = async (userId: string, domain: string) => {
  const dbUser = await prisma.user.update({
    where: { discordId: userId },
    data: { domain },
  });
  return dbUser;
};

export const getPostsByUser = async (userId: string) => {
  const posts = await prisma.post.findMany({
    where: { user: { discordId: userId }, isPublished: true },
  });
  return posts;
};

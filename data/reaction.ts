import { logger } from "@/client";
import { prisma } from "@/utils/prisma";
import { Emoji, Post, User } from "@prisma/client";
import { MessageReaction } from "discord.js";
import { findEmoji } from "./emoji";
import { findUserById } from "./user";

export async function findReaction(postId, userId, emojiId) {
  const dbReaction = await prisma.reaction.findUnique({
    where: {
      postId_userDiscordId_emojiId: {
        postId,
        emojiId,
        userDiscordId: userId,
      },
    },
  });
  return dbReaction;
}

/**
 * Upsert a reaction
 * @param post
 * @param dbUser
 * @param emoji
 * @returns
 */
export async function upsertReaction(post: Post, dbUser: User, emoji: Emoji) {
  const dbReaction = await prisma.reaction.upsert({
    where: {
      postId_userDiscordId_emojiId: {
        postId: post.id,
        emojiId: emoji.id,
        userDiscordId: dbUser.discordId,
      },
    },
    update: {},
    create: {
      postId: post.id,
      emojiId: emoji.id,
      userDiscordId: dbUser.discordId,
    },
  });

  if (!dbReaction) {
    throw new Error("Reaction could not be upserted");
  }

  return dbReaction;
}

export async function deleteReaction(
  postId: string,
  userId: string,
  emojiId: string
) {
  await prisma.reaction.delete({
    where: {
      postId_userDiscordId_emojiId: {
        postId,
        emojiId,
        userDiscordId: userId,
      },
    },
  });
}

export async function getPostUserEmojiFromReaction(
  reaction: MessageReaction,
  discordUserId: string
) {
  const post = await prisma.post.findUnique({
    where: { id: reaction.message.id },
    include: {
      reactions: {
        include: {
          emoji: {
            include: {
              PaymentRule: true, // Include PaymentRule in the emoji
            },
          },
        },
      },
    },
  });
  if (!post) {
    logger.warn(
      `Post with ID ${reaction.message.id} not found in the database. Skipping.`
    );
    throw new Error(
      `Post with ID ${reaction.message.id} not found in the database. Skipping.`
    );
  }

  const dbUser = await findUserById(discordUserId);
  if (!dbUser) {
    logger.warn(`User  not found in the database. Skipping.`);
    throw new Error(`User  not found in the database. Skipping.`);
  }

  const dbEmoji = await findEmoji(reaction.emoji);
  if (!dbEmoji) {
    logger.warn(
      `Emoji ${reaction.emoji.name} not found in the database. Skipping.`
    );
    throw new Error(
      `Emoji ${reaction.emoji.name} not found in the database. Skipping.`
    );
  }

  return {
    post,
    dbUser,
    dbEmoji,
  };
}

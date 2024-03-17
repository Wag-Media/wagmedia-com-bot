import { logger } from "@/client";
import { prisma } from "@/utils/prisma";
import { Emoji, OddJob, Post, User } from "@prisma/client";
import { MessageReaction } from "discord.js";
import { findEmoji } from "./emoji";
import { findUserById } from "./user";
import { ContentType } from "@/types";

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

export async function getPostReactions(postId: string) {
  const dbReactions = await prisma.reaction.findMany({
    where: {
      postId,
    },
    include: {
      emoji: true,
    },
  });
  return dbReactions;
}

export async function upsertEntityReaction(
  entity: Post | OddJob | undefined | null,
  entityType: ContentType,
  dbUser: User,
  dbEmoji: Emoji
) {
  if (!entityType || !entity) {
    logger.warn("Invalid content entityType in upsertEntityReaction");
    return;
  }

  let dbReaction;

  if (entityType == "post" || entityType == "thread") {
    dbReaction = await upsertPostReaction(entity as Post, dbUser, dbEmoji);
  } else {
    dbReaction = await upsertOddjobReaction(entity as OddJob, dbUser, dbEmoji);
  }

  if (!dbReaction) {
    throw new Error("Reaction could not be upserted");
  }
  return dbReaction;
}

export async function deleteEntityReaction(
  entity: Post | OddJob | undefined | null,
  contentType: ContentType,
  userId: string,
  emojiId: string
) {
  if (!contentType || !entity) {
    logger.warn("Invalid content contentType in deleteEntityReaction");
    return;
  }

  const whereCondition =
    contentType === "post" || contentType === "thread"
      ? {
          postId_userDiscordId_emojiId: {
            postId: entity.id,
            emojiId,
            userDiscordId: userId,
          },
        }
      : {
          oddJobId_userDiscordId_emojiId: {
            oddJobId: entity.id,
            emojiId,
            userDiscordId: userId,
          },
        };
  await prisma.reaction.delete({
    where: whereCondition,
  });
}

/**
 * Upsert a reaction
 * @param post
 * @param dbUser
 * @param emoji
 * @returns
 */
export async function upsertPostReaction(
  post: Post,
  dbUser: User,
  dbEmoji: Emoji
) {
  const dbReaction = await prisma.reaction.upsert({
    where: {
      postId_userDiscordId_emojiId: {
        postId: post.id,
        emojiId: dbEmoji.id,
        userDiscordId: dbUser.discordId,
      },
    },
    update: {},
    create: {
      postId: post.id,
      emojiId: dbEmoji.id,
      userDiscordId: dbUser.discordId,
    },
  });

  if (!dbReaction) {
    throw new Error("Reaction could not be upserted");
  }
  return dbReaction;
}

/**
 * Upsert a oddjob reaction
 * @param post
 * @param dbUser
 * @param emoji
 * @returns
 */
export async function upsertOddjobReaction(
  oddjob: OddJob,
  dbUser: User,
  emoji: Emoji
) {
  const dbReaction = await prisma.reaction.upsert({
    where: {
      oddJobId_userDiscordId_emojiId: {
        oddJobId: oddjob.id,
        emojiId: emoji.id,
        userDiscordId: dbUser.discordId,
      },
    },
    update: {},
    create: {
      oddJobId: oddjob.id,
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
      `[post] Post with ID ${reaction.message.id} not found in the database. Skipping.`
    );
    throw new Error(
      `Post with ID ${reaction.message.id} not found in the database. Skipping.`
    );
  }

  const dbUser = await findUserById(discordUserId);
  if (!dbUser) {
    logger.warn(`[user] User not found in the database. Skipping.`);
    throw new Error(`User  not found in the database. Skipping.`);
  }

  const dbEmoji = await findEmoji(reaction.emoji);
  if (!dbEmoji) {
    logger.warn(
      `[emoji] Emoji ${reaction.emoji.name} not found in the database. Skipping.`
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

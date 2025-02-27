import { logger } from "@/client";
import { prisma } from "@/utils/prisma";
import { Emoji, OddJob, Post, User } from "@prisma/client";
import { GuildEmoji, MessageReaction } from "discord.js";
import { findEmoji } from "./emoji";
import { findOrCreateUserFromDiscordUser, findUserById } from "./user";
import { ContentType, ReactionWithEmoji } from "@/types";
import { DiscordReaction } from "../types";
import { PolkadotEvent } from "@prisma/client";

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

export async function getPostOrOddjobReactions(
  contentId: string,
  contentType: ContentType,
): Promise<ReactionWithEmoji[]> {
  let whereCondition;

  if (
    contentType === "post" ||
    contentType === "thread" ||
    contentType === "newsletter"
  ) {
    whereCondition = { postId: contentId };
  } else if (contentType === "event") {
    whereCondition = { eventId: contentId };
  } else {
    whereCondition = { oddJobId: contentId };
  }

  const dbReactions = await prisma.reaction.findMany({
    where: whereCondition,
    orderBy: {
      createdAt: "asc",
    },
    include: {
      emoji: true,
    },
  });
  return dbReactions;
}

export async function upsertEntityReaction(
  entity: Post | OddJob | PolkadotEvent | undefined | null,
  entityType: ContentType,
  dbUser: User,
  dbEmoji: Emoji,
) {
  if (!entityType || !entity) {
    logger.warn("Invalid content entityType in upsertEntityReaction");
    return;
  }

  const validContentTypes = [
    "post",
    "oddjob",
    "thread",
    "newsletter",
    "event",
  ] as const;

  if (!validContentTypes.includes(entityType)) {
    throw new Error(
      `Invalid entityType ${entityType} in upsertEntityReaction. Skipping.`,
    );
  }

  let dbReaction;

  if (entityType === "event") {
    dbReaction = await upsertEventReaction(
      entity as PolkadotEvent,
      dbUser,
      dbEmoji,
    );
  } else if (
    entityType === "post" ||
    entityType === "thread" ||
    entityType === "newsletter"
  ) {
    dbReaction = await upsertPostReaction(entity as Post, dbUser, dbEmoji);
  } else if (entityType === "oddjob") {
    dbReaction = await upsertOddjobReaction(entity as OddJob, dbUser, dbEmoji);
  } else {
    logger.warn(
      `Invalid entityType ${entityType} in upsertEntityReaction. Skipping.`,
    );
  }

  if (!dbReaction) {
    throw new Error("Reaction could not be upserted");
  }
  return dbReaction;
}

export async function deleteEntityReaction(
  entity: Post | OddJob | PolkadotEvent | undefined | null,
  contentType: ContentType,
  userId: string,
  emojiId: string,
) {
  if (!contentType || !entity) {
    console.warn(
      "Invalid content contentType in deleteEntityReaction. Skipping.",
    );
    return;
  }

  if (
    ![contentType, "post", "thread", "newsletter", "event"].includes(
      contentType,
    )
  ) {
    throw new Error(
      `Invalid contentType ${contentType} in deleteEntityReaction. Skipping.`,
    );
  }

  const whereCondition =
    contentType === "post" ||
    contentType === "thread" ||
    contentType === "newsletter"
      ? {
          postId_userDiscordId_emojiId: {
            postId: entity.id,
            emojiId,
            userDiscordId: userId,
          },
        }
      : contentType === "event"
        ? {
            eventId_userDiscordId_emojiId: {
              eventId: entity.id,
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
  dbEmoji: Emoji,
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
  emoji: Emoji,
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

export async function upsertEventReaction(
  event: PolkadotEvent,
  dbUser: User,
  dbEmoji: Emoji,
) {
  const dbReaction = await prisma.reaction.upsert({
    where: {
      eventId_userDiscordId_emojiId: {
        eventId: event.id,
        emojiId: dbEmoji.id,
        userDiscordId: dbUser.discordId,
      },
    },
    update: {},
    create: {
      eventId: event.id,
      emojiId: dbEmoji.id,
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
  emojiId: string,
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

export async function removeReactions(
  messageId: string,
  reactions: DiscordReaction[],
) {
  const emojiIds = reactions
    .map((r) => r.emoji.name || r.emoji.id)
    .filter((id): id is string => id !== null);
  const userDiscordIds = reactions.map((r) => r.user.id);

  if (
    emojiIds.length === 0 ||
    userDiscordIds.length === 0 ||
    emojiIds.length !== userDiscordIds.length
  ) {
    console.warn("remove reactions strange case", reactions);
    return;
  }

  const deletedReactions = await prisma.reaction.deleteMany({
    where: {
      userDiscordId: { in: userDiscordIds },
      emojiId: { in: emojiIds },
      OR: [
        { postId: messageId },
        { oddJobId: messageId },
        { eventId: messageId },
      ],
    },
  });

  logger.log(
    `removed ${deletedReactions.count} reactions from message ${messageId}: 
    ${reactions.map((r) => `${r.user.id}-${r.emoji.name || r.emoji.id} `)}`,
  );
}

export async function getPostUserEmojiFromReaction(
  reaction: MessageReaction,
  discordUserId: string,
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
      `[post] Post with ID ${reaction.message.id} not found in the database. Skipping.`,
    );
    throw new Error(
      `Post with ID ${reaction.message.id} not found in the database. Skipping.`,
    );
  }

  const dbUser = await findUserById(discordUserId);
  if (!dbUser) {
    logger.warn(`[user] User not found in the database. Skipping.`);
    throw new Error(`User  not found in the database. Skipping.`);
  }

  const dbEmoji = await findEmoji(reaction.emoji as GuildEmoji);
  if (!dbEmoji) {
    logger.warn(
      `[emoji] Emoji ${reaction.emoji.name} not found in the database. Skipping.`,
    );
    throw new Error(
      `Emoji ${reaction.emoji.name} not found in the database. Skipping.`,
    );
  }

  return {
    post,
    dbUser,
    dbEmoji,
  };
}

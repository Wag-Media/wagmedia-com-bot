import { prisma } from "@/utils/prisma";
import { Emoji, Post, User } from "@prisma/client";

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

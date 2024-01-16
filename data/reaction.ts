import { prisma } from "@/utils/prisma";

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

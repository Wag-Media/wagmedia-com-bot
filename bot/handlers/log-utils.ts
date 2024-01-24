import { logger } from "@/client";
import { prisma } from "@/utils/prisma";
import { Post } from "@prisma/client";
import { MessageReaction, User as DiscordUser } from "discord.js";

export function logNewEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.log(
    `new emoji received on valid post ${messageLink} ${JSON.stringify(
      reaction.emoji.name
    )} by ${user.displayName}`
  );
}

export function logNewRegularUserEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.log(
    `new regular user emoji recorded on valid post ${messageLink} ${JSON.stringify(
      reaction.emoji.name
    )} by ${user.displayName}`
  );
}

export function logEmojiRemoved(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.log(
    `Reaction ${reaction.emoji.name} removed from message ${messageLink} by user ${user.username}#${user.discriminator}.`
  );
}

export async function logPostEarnings(post: Post) {
  // Fetch all earnings for the post after the update
  const allPostEarnings = await prisma.postEarnings.findMany({
    where: {
      postId: post.id,
    },
  });

  // log the total earnings of the post
  const totalEarningsPerUnit = allPostEarnings.reduce(
    (acc, curr) => ({ ...acc, [curr.unit]: curr.totalAmount }),
    {}
  );
  logger.log(
    `Total earnings for the above post: ${JSON.stringify(totalEarningsPerUnit)}`
  );
}

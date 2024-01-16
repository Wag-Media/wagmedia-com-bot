import { PrismaClient } from "@prisma/client";
import {
  MessageReaction,
  User as DiscordUser,
  PartialMessageReaction,
  PartialUser,
} from "discord.js";
import * as config from "../config.js";
import { logger } from "@/client.js";
import { findEmoji, findOrCreateEmoji } from "@/data/emoji.js";
import { userHasRole } from "@/utils/userHasRole.js";

const prisma = new PrismaClient();

/**
 * Handle a reaction being removed from a message.
 * @param reaction
 * @param user
 * @returns
 */
export async function handleMessageReactionRemove(
  reaction: MessageReaction | PartialMessageReaction,
  user: DiscordUser | PartialUser
) {
  // Similar checks as in handleMessageReactionAdd
  if (!config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id)) return;
  if (user.bot) return; // Ignore bot reactions
  if (!reaction.message.guild) return; // Ignore DMs

  const guild = reaction.message.guild;

  // make sure the message, reaction and user are cached
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      logger.error("Something went wrong when fetching the message:", error);
      return;
    }
  }

  if (reaction.partial) {
    try {
      reaction = (await reaction.fetch()) as MessageReaction;
    } catch (error) {
      logger.error("Something went wrong when fetching the reaction:", error);
      return;
    }
  }

  if (user.partial) {
    try {
      user = (await user.fetch()) as DiscordUser;
    } catch (error) {
      logger.error("Something went wrong when fetching the user:", error);
      return;
    }
  }

  const messageLink = `https://discord.com/channels/${guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
  if (!userHasRole(guild, user, config.ROLES_WITH_POWER)) {
    // TODO if the user doesn't have the role, remove the reaction
    return;
  }

  const emoji = await findEmoji(reaction.emoji);

  if (!emoji) {
    logger.log(
      `Emoji ${reaction.emoji.name} not found in the database. Skipping.`
    );
    return;
  }

  logger.log(
    `Reaction ${reaction.emoji.name} removed from message ${messageLink} by user ${user.username}#${user.discriminator}.`
  );

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
    logger.log(
      `Post with ID ${reaction.message.id} not found in the database.`
    );
    return;
  }

  // Find the payment rule for the emoji
  const paymentRule = await prisma.paymentRule.findFirst({
    where: { emojiId: emoji.id },
  });

  if (paymentRule) {
    if (!post.totalEarnings) {
      logger.warn(
        `Post ${reaction.message.id} has no total earnings. Skipping.`
      );
      return;
    }

    // Remove the reaction (cascade delete will remove associated payments)
    await prisma.reaction.delete({
      where: {
        postId_userDiscordId_emojiId: {
          postId: post.id,
          emojiId: emoji.id,
          userDiscordId: user.id,
        },
      },
    });

    // Refetch the post and its reactions to get updated state
    const updatedPost = await prisma.post.findUnique({
      where: { id: reaction.message.id },
      include: {
        reactions: {
          include: {
            emoji: {
              include: {
                PaymentRule: true,
              },
            },
          },
        },
      },
    });

    // Fetch all reactions for the post and filter in code to include only those with a PaymentRule
    const remainingReactions = await prisma.reaction.findMany({
      where: { postId: post.id },
      include: {
        emoji: {
          include: {
            PaymentRule: true,
          },
        },
      },
    });

    // Aggregate the total payment amount from remaining reactions
    const updatedTotalEarnings = remainingReactions.reduce(
      (total, reaction) => {
        return total + (reaction.emoji.PaymentRule[0]?.paymentAmount || 0);
      },
      0
    );

    // Update the post's total earnings
    await prisma.post.update({
      where: { id: post.id },
      data: { totalEarnings: updatedTotalEarnings },
    });

    logger.log(
      `Payment rule processed for above post: new total earnings ${updatedTotalEarnings}`
    );

    // Check if there are no remaining payment emojis on the post
    // Check if there are no remaining payment emojis on the updated post
    const remainingPaymentEmojis = updatedPost!.reactions.filter(
      (reaction) =>
        reaction.emoji.PaymentRule && reaction.emoji.PaymentRule.length > 0
    );

    if (remainingPaymentEmojis.length === 0) {
      // If no payment emojis are left, unpublish the post
      await prisma.post.update({
        where: { id: reaction.message.id },
        data: { isPublished: false },
      });
      logger.log(
        `Post ${reaction.message.id} has been unpublished due to no remaining payment emojis.`
      );
    }
  }

  // ... Add any additional logic for other emojis or conditions
}

import { Payment } from "@prisma/client";
import { Emoji, Message, MessageReaction, User } from "discord.js";
import { parseDiscordUserId } from "../handlers/util";
import { prisma } from "./prisma";
import { logger } from "@/client";
import { findEmojiPaymentRule, findOrCreateEmoji } from "@/data/emoji";

/**
 * Function checks if the reaction is valid for a payment
 * i.e. the reaction comes from the same set of emojis with the same unit
 * the first reaction came from
 * @param message
 * @param reaction
 * @returns
 */
export async function isPaymentReactionValid(
  message: Message,
  reaction: MessageReaction,
  messageLink?: string
): Promise<boolean> {
  // Try to determine the type (Post or OddJob) based on the discordLink or other identifiers
  let entityType = ""; // 'post' or 'oddjob'
  let entityId = "";

  // Example logic to determine if it's a Post or OddJob
  const post = await prisma.post.findUnique({
    where: { id: message.id },
  });
  const oddJob = post
    ? null
    : await prisma.oddJob.findUnique({
        where: { id: message.id },
      });

  if (post) {
    entityType = "post";
    entityId = post.id;
  } else if (oddJob) {
    entityType = "oddjob";
    entityId = oddJob.id;
  } else {
    logger.warn(
      `No associated Post or OddJob found for this message ${messageLink}`
    );
    return false;
  }

  // Fetch the first payment based on the determined entity type
  const paymentCondition =
    entityType === "post" ? { postId: entityId } : { oddJobId: entityId };

  const firstPayment = await prisma.payment.findFirst({
    where: paymentCondition,
    include: {
      reaction: {
        include: {
          emoji: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!firstPayment || !firstPayment.reaction) {
    logger.info(
      `Payment for ${messageLink} is valid because it is the first payment.`
    );
    return true;
  }

  // Retrieve the payment rule for the reaction emoji
  const dbEmoji = await findOrCreateEmoji(reaction.emoji);
  const paymentRule = await findEmojiPaymentRule(dbEmoji.id);

  if (!paymentRule) {
    logger.log("No payment rule found for this reaction emoji.");
    return false;
  }

  // Validate the reaction's payment rule against the first payment's rule
  return (
    paymentRule.paymentUnit === firstPayment.unit &&
    paymentRule.fundingSource === firstPayment.fundingSource
  );
}

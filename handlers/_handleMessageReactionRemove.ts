import {
  Category,
  PaymentRule,
  Post,
  PrismaClient,
  User,
  Emoji as DbEmoji,
} from "@prisma/client";
import {
  MessageReaction,
  User as DiscordUser,
  PartialMessageReaction,
  PartialUser,
  Emoji,
  Message,
} from "discord.js";
import * as config from "@/config";
import { logger } from "@/client";
import {
  findEmoji,
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji";
import { userHasRole } from "@/utils/userHasRole.js";
import { ensureFullEntities, shouldIgnoreReaction } from "./util.js";
import { logEmojiRemoved, logPostEarnings } from "./log-utils.js";
import {
  deleteReaction,
  getPostUserEmojiFromReaction,
} from "@/data/reaction.js";
import { removeCategoryFromPost } from "@/data/post.js";
import { isChannelMonitoredForOddJobs } from "./util.js";

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
  // guild is not null because we checked for it in shouldIgnoreReaction
  const guild = reaction.message.guild!;
  const messageLink = `https://discord.com/channels/${guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

  // make sure the message, reaction and user are cached
  try {
    const fullEntities = await ensureFullEntities(reaction, user);
    reaction = fullEntities.reaction;
    user = fullEntities.user;
  } catch (error) {
    logger.error(
      "Error ensuring full entities when removing a message reaction:",
      error
    );
    return;
  }

  // Similar checks as in handleMessageReactionAdd
  if (shouldIgnoreReaction(reaction)) return;

  if (isChannelMonitoredForOddJobs(reaction.message.channel)) {
    //TODO
    return;
  } else {
    try {
      const { post, dbUser, dbEmoji } = await getPostUserEmojiFromReaction(
        reaction,
        user.id
      );

      logEmojiRemoved(reaction, user, messageLink);

      if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
        processSuperuserReactionRemove(
          reaction,
          user,
          dbUser,
          post,
          dbEmoji,
          messageLink
        );
      } else {
        processRegularUserReactionRemove(dbUser, post, dbEmoji);
      }
    } catch (error) {
      logger.error("Error logging emoji removed:", error);
    }
  }
}

export async function processRegularUserReactionRemove(
  dbUser: User,
  post: Post,
  dbEmoji: DbEmoji
) {
  try {
    // dbEmoji.id is not null because we checked for it in getPostUserEmojiFromReaction
    await deleteReaction(post.id, dbUser.discordId, dbEmoji.id!);
  } catch (error) {
    // it was probably already deleted
    return;
  }
}

export async function processSuperuserReactionRemove(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: Post,
  dbEmoji: DbEmoji,
  messageLink: string
) {
  try {
    // dbEmoji.id is not null because we checked for it in getPostUserEmojiFromReaction
    await deleteReaction(post.id, dbUser.discordId, dbEmoji.id!);

    const paymentRule = await findEmojiPaymentRule(dbEmoji.id!);
    if (paymentRule) {
      handleSuperUserPaymentRuleReactionRemove(post, paymentRule, messageLink);
      return;
    }

    const categoryRule = await findEmojiCategoryRule(dbEmoji.id!);
    if (categoryRule) {
      handleSuperUserCategoryRuleReactionRemove(
        reaction,
        post,
        categoryRule,
        discordUser,
        messageLink
      );
    }
  } catch (error) {
    logger.error("Error deleting superuser reaction:", error);
  }
}

export async function handleSuperUserCategoryRuleReactionRemove(
  reaction: MessageReaction,
  post,
  categoryRule,
  discordUser,
  messageLink: string
) {
  //1. Check if the post has any remaining categories
  const remainingCategories = await prisma.category.findMany({
    where: { posts: { some: { id: post.id } } },
  });

  if (remainingCategories.length > 1) {
    await removeCategoryFromPost(post.id, categoryRule.categoryId);
    logger.log(
      `[category] Category ${categoryRule.category.name} removed from ${messageLink}.`
    );
    return;
  } else if (remainingCategories.length === 1) {
    if (post.isPublished) {
      logger.logAndSend(
        `🚨 The category ${categoryRule.category.name} has been removed from the post ${messageLink}. The post has no remaining but will keep its last category in the db / website until new categories are added.`,
        discordUser,
        "warn"
      );
    } else {
      await removeCategoryFromPost(post.id, categoryRule.categoryId);
    }
  }
}

export async function handleSuperUserPaymentRuleReactionRemove(
  post: Post,
  paymentRule: PaymentRule,
  messageLink: string
) {
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

  // Check if there are no remaining payment emojis
  const remainingPaymentEmojis = remainingReactions.filter(
    (r) => r.emoji.PaymentRule && r.emoji.PaymentRule.length > 0
  );

  // If no payment emojis are left, unpublish the post
  if (remainingPaymentEmojis.length === 0) {
    await prisma.post.update({
      where: { id: post.id },
      data: { isPublished: false },
    });
    logger.log(
      `[post] Post ${messageLink} has been unpublished due to no remaining payment emojis.`
    );
  }

  // Aggregate the total payment amount for the specific unit
  const updatedTotalEarnings = remainingPaymentEmojis.reduce((total, r) => {
    const rule = r.emoji.PaymentRule.find(
      (pr) => pr.paymentUnit === paymentRule.paymentUnit
    );
    return total + (rule?.paymentAmount || 0);
  }, 0);

  // Update the post's total earnings for the specific unit
  await prisma.contentEarnings.upsert({
    where: {
      postId_unit: {
        postId: post.id,
        unit: paymentRule.paymentUnit,
      },
    },
    update: {
      totalAmount: updatedTotalEarnings,
    },
    create: {
      postId: post.id,
      unit: paymentRule.paymentUnit,
      totalAmount: updatedTotalEarnings,
    },
  });

  logPostEarnings(post, messageLink);
}

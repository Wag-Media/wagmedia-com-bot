import {
  Category,
  PaymentRule,
  Post,
  PrismaClient,
  User,
} from "@prisma/client";
import {
  MessageReaction,
  User as DiscordUser,
  PartialMessageReaction,
  PartialUser,
  Emoji,
} from "discord.js";
import * as config from "../config.js";
import { logger } from "@/client.js";
import {
  findEmoji,
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji.js";
import { userHasRole } from "@/utils/userHasRole.js";
import { ensureFullEntities, shouldIgnoreReaction } from "./util.js";
import { logEmojiRemoved, logPostEarnings } from "./log-utils";
import {
  deleteReaction,
  getPostUserEmojiFromReaction,
} from "@/data/reaction.js";
import { removeCategoryFromPost } from "@/data/post.js";

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
  if (shouldIgnoreReaction(reaction, user)) return;

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

  try {
    const { post, dbUser, dbEmoji } = await getPostUserEmojiFromReaction(
      reaction,
      user.id
    );

    logEmojiRemoved(reaction, user, messageLink);

    if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
      processSuperuserReactionRemove(reaction, user, dbUser, post, dbEmoji);
    } else {
      processRegularUserReactionRemove(dbUser, post, dbEmoji);
    }
  } catch (error) {
    logger.error("Error logging emoji removed:", error);
  }
}

export async function processRegularUserReactionRemove(
  dbUser: User,
  post: Post,
  dbEmoji: Emoji
) {
  try {
    // dbEmoji.id is not null because we checked for it in getPostUserEmojiFromReaction
    await deleteReaction(post.id, dbUser.discordId, dbEmoji.id!);
  } catch (error) {
    logger.error("Error deleting regular user reaction:", error);
  }
}

export async function processSuperuserReactionRemove(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: Post,
  dbEmoji: Emoji
) {
  try {
    // dbEmoji.id is not null because we checked for it in getPostUserEmojiFromReaction
    await deleteReaction(post.id, dbUser.discordId, dbEmoji.id!);

    const paymentRule = await findEmojiPaymentRule(dbEmoji.id!);
    if (paymentRule) {
      handleSuperUserPaymentRuleReactionRemove(post, paymentRule);
      return;
    }

    const categoryRule = await findEmojiCategoryRule(dbEmoji.id!);
    if (categoryRule) {
      handleSuperUserCategoryRuleReactionRemove(
        post,
        categoryRule,
        discordUser
      );
    }
  } catch (error) {
    logger.error("Error deleting superuser reaction:", error);
  }
}

export async function handleSuperUserCategoryRuleReactionRemove(
  post,
  categoryRule,
  discordUser
) {
  //1. Remove the category from the post
  removeCategoryFromPost(post.id, categoryRule.categoryId);

  //2. Check if the post has any remaining categories
  const remainingCategories = await prisma.category.findMany({
    where: { posts: { some: { id: post.id } } },
  });

  //3. If the post has no remaining categories, unpublish it
  if (remainingCategories.length === 0) {
    await prisma.post.update({
      where: { id: post.id },
      data: { isPublished: false },
    });

    discordUser.send(
      `🚨 The category ${categoryRule.category.name} has been removed from your post.`
    );
    logger.warn(
      `Post ${post.id} has been unpublished due to no remaining categories.`
    );
  }
}

export async function handleSuperUserPaymentRuleReactionRemove(
  post: Post,
  paymentRule: PaymentRule
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
      `Post ${post.id} has been unpublished due to no remaining payment emojis.`
    );
    return;
  }

  // Aggregate the total payment amount for the specific unit
  const updatedTotalEarnings = remainingPaymentEmojis.reduce((total, r) => {
    const rule = r.emoji.PaymentRule.find(
      (pr) => pr.paymentUnit === paymentRule.paymentUnit
    );
    return total + (rule?.paymentAmount || 0);
  }, 0);

  // Update the post's total earnings for the specific unit
  await prisma.postEarnings.upsert({
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

  logPostEarnings(post);
}

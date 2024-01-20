import {
  findEmoji,
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji.js";
import { userHasRole } from "@/utils/userHasRole.js";
import {
  Category,
  CategoryRule,
  Emoji,
  PaymentRule,
  Post,
  PrismaClient,
  Reaction,
  User,
} from "@prisma/client";
import {
  MessageReaction,
  User as DiscordUser,
  PartialMessageReaction,
  PartialUser,
  Guild,
  messageLink,
} from "discord.js";
import * as config from "../config.js";
import { logger } from "@/client.js";
import { ensureFullEntities, shouldIgnoreReaction } from "./util.js";
import { fetchPost } from "@/data/post.js";
import {
  logNewEmojiReceived,
  logNewRegularUserEmojiReceived,
} from "./log-utils.js";
import {
  findOrCreateUser,
  findOrCreateUserFromDiscordUser,
} from "@/data/user.js";
import { upsertReaction } from "@/data/reaction.js";
import { isCountryFlag } from "../utils/is-country-flag";

const prisma = new PrismaClient();

/**
 * Handle a reaction being added to a message. Perform checks if the user is authorized and the reaction is valid.
 * @param reaction
 * @param user
 * @returns
 */
export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: DiscordUser | PartialUser
) {
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
    logger.error("Error ensuring full entities:", error);
    return;
  }

  try {
    const post = await fetchPost(reaction);
    // if the message doesn't exist in the database,
    // ignore the reaction as the message is not relevant for the bot
    if (!post) return;

    logNewEmojiReceived(reaction, user, messageLink);
    const dbEmoji = await findOrCreateEmoji(reaction.emoji);

    // upsert the user who reacted
    const dbUser = await findOrCreateUserFromDiscordUser(user);
    if (!dbUser) {
      logger.error("User not found in the database.");
      return;
    }

    if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
      await processSuperuserReaction(reaction, user, dbUser, post, dbEmoji);
    } else {
      await processRegularUserReaction(
        reaction,
        user,
        dbUser,
        post,
        dbEmoji,
        messageLink
      );
    }
  } catch (error) {
    logger.error("Error querying the database for the post:", error);
    return;
  }
}

export async function processRegularUserReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: Post & { categories: Category[] },
  dbEmoji: Emoji,
  messageLink: string
) {
  // Remove WM emojis if the user does not have the power role
  if (reaction.emoji.name?.startsWith("WM")) {
    await discordUser.send(
      `You do not have permission to add WagMedia emojis in ${messageLink}`
    );
    logger.log(
      `Informed ${discordUser.tag} about not having permission to use a WagMedia emoji.`
    );
    await reaction.users.remove(discordUser.id);
  } else if (isCountryFlag(reaction.emoji.id)) {
    await discordUser.send(
      `You do not have permission to add country flag emojis in ${messageLink}`
    );
    logger.log(
      `Informed ${discordUser.tag} about not having permission to use a country flag emoji.`
    );
    await reaction.users.remove(discordUser.id);
  } else {
    await upsertReaction(post, dbUser, dbEmoji);
    logNewRegularUserEmojiReceived(reaction, discordUser, messageLink);
  }
}

export async function processSuperuserReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: Post & { categories: Category[] },
  dbEmoji: Emoji
) {
  const postId = reaction.message.id;
  const dbReaction = await upsertReaction(post, dbUser, dbEmoji);

  // process possible rules for the emoji
  // 1. Category Rule
  // 2. Payment Rule
  // 3. Feature Rule

  try {
    // 1. Check for Category Rule
    const categoryRule = await findEmojiCategoryRule(dbEmoji.id);
    if (categoryRule) {
      await handleCategoryRule(postId, categoryRule);
      return;
    }

    // 2. Check for Payment Rule
    const paymentRule = await findEmojiPaymentRule(dbEmoji.id);
    if (paymentRule) {
      // first check if the post is complete before publishing it by adding the payment emoji
      const isPostIncomplete = await handlePostIncomplete(
        post,
        discordUser,
        reaction
      );

      // if the post is complete, process the payment rule (=add payment and publish post)
      if (!isPostIncomplete) {
        await handlePaymentRule(post, dbUser.id, paymentRule, dbReaction.id);
      }
      return;
    }

    // 3. Check for Feature Rule
    if (dbEmoji.name === config.FEATURE_EMOJI) {
      await prisma.post.update({
        where: {
          id: reaction.message.id,
        },
        data: {
          isFeatured: true,
        },
      });
      return;
    }

    logger.log("No action rule found for this reaction.");
  } catch (error) {
    logger.error("Error processing reaction:", error);
  }
}

/**
 * Check if the post is incomplete, inform the user if it is and remove their reaction.
 * @param post
 * @param discordUser
 * @param reaction
 * @returns true if the post is incomplete, false otherwise
 */
async function handlePostIncomplete(
  post: Post & { categories: Category[] },
  discordUser: DiscordUser,
  reaction: MessageReaction
) {
  const postCategories = post.categories;
  const messageLink = `https://discord.com/channels/${reaction.message.guild?.id}/${reaction.message.channel.id}/${reaction.message.id}`;

  // 1.  make sure the post has a category
  if (postCategories.length === 0) {
    await discordUser.send(
      `Before you can publish the post ${messageLink}, make sure it has a category.`
    );
    logger.log(
      `Informed ${discordUser.tag} about the post not having a category when trying to publish.`
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  // 2. make sure non anglo posts have a flag
  const isNonAnglo = postCategories.some((category) =>
    category.name.includes("Non Anglo")
  );

  if (isNonAnglo) {
    //get post reactions
    const postReactions = await prisma.reaction.findMany({
      where: { postId: post.id },
      include: { emoji: true },
    });

    // check if the post has a flag
    const hasFlag = postReactions.some((reaction) =>
      isCountryFlag(reaction.emoji?.id)
    );

    if (!hasFlag) {
      await discordUser.send(
        `Before you can publish the post ${messageLink}, with non-anglo category, make sure it has a flag.`
      );
      logger.log(
        `Informed ${discordUser.tag} about the post not having a flag when trying to publish.`
      );
      await reaction.users.remove(discordUser.id);
      return true;
    }
  }

  // 3. make sure translation posts have a non anglo category
  const isTranslation = postCategories.some((category) =>
    category.name.includes("Translations")
  );

  if (isTranslation && !isNonAnglo) {
    await discordUser.send(
      `Before you can publish the post ${messageLink} with a translation category, make sure it also has a Non Anglo category.`
    );
    logger.log(
      `Informed ${discordUser.tag} about a translated post not having a Non Anglo category when trying to publish.`
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  return false;
}

async function handlePaymentRule(
  post: Post & { categories: Category[] },
  userId: number,
  paymentRule: PaymentRule,
  reactionId: number
) {
  const amount = paymentRule.paymentAmount;

  await prisma.payment.upsert({
    where: {
      // Define unique identifier for payment, e.g., a combination of postId and userId
      postId_userId_reactionId: {
        postId: post.id,
        userId,
        reactionId: reactionId,
      },
    },
    update: {
      amount, // Update the payment amount or any other necessary fields
    },
    create: {
      postId: post.id,
      userId,
      amount,
      status: "unknown", // initial payment status
      reactionId: reactionId,
    },
  });

  if (!post.totalEarnings) {
    logger.log(`The above post has been published.`);
  }

  // Update the post's total earnings
  const updatedEarnings = (post.totalEarnings || 0) + amount;
  await prisma.post.update({
    where: { id: post.id },
    data: { totalEarnings: updatedEarnings, isPublished: true },
  });

  logger.log(
    `Payment rule processed for above post: new total earnings ${updatedEarnings}`
  );
}

async function handleCategoryRule(
  postId: string,
  categoryRule: CategoryRule & { category: Category }
) {
  await prisma.post.update({
    where: { id: postId },
    data: {
      categories: {
        connect: { id: categoryRule.categoryId },
      },
    },
  });

  logger.log(
    `Category rule processed for above post: added category ${categoryRule.category.name}`
  );
}

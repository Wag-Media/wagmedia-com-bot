import { findOrCreateEmoji } from "@/data/emoji.js";
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
} from "discord.js";
import * as config from "../config.js";
import { logger } from "@/client.js";

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
  // Check if the reaction is in the channel we are interested in
  if (!config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id)) return;
  if (user.bot) return; // Ignore bot reactions
  if (!reaction.message.guild) return; // Ignore DMs

  const guild = reaction.message.guild;

  // make sure the message, reaction and user are cached
  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      console.error("Something went wrong when fetching the message:", error);
      return;
    }
  }

  if (reaction.partial) {
    try {
      reaction = (await reaction.fetch()) as MessageReaction;
    } catch (error) {
      console.error("Something went wrong when fetching the reaction:", error);
      return;
    }
  }

  if (user.partial) {
    try {
      user = (await user.fetch()) as DiscordUser;
    } catch (error) {
      console.error("Something went wrong when fetching the user:", error);
      return;
    }
  }

  const messageLink = `https://discord.com/channels/${guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

  // Check if the message exists in the database i.e.,
  // if it is a valid post with title and description
  try {
    const post = await prisma.post.findUnique({
      where: {
        id: reaction.message.id,
      },
      include: {
        categories: true, // Include the categories in the result
      },
    });

    if (!post) {
      console.log(
        `Post with ID ${reaction.message.id} not found in the database.`
      );
      return; // Skip handling if the post is not found
    }

    logger.log(
      `new emoji received on valid post ${messageLink} ${JSON.stringify(
        reaction.emoji.name
      )} by ${user.displayName}`
    );

    // Remove WM emojis if the user does not have the power role
    if (
      !userHasRole(guild, user, config.ROLES_WITH_POWER) &&
      reaction.emoji.name?.startsWith("WM")
    ) {
      await user.send(
        `You do not have permission to add WagMedia emojis in ${messageLink}`
      );
      logger.log(
        `Informed ${user.tag} about not having permission to use the emoji.`
      );
      await reaction.users.remove(user.id);
      return;
    }

    const emoji = await findOrCreateEmoji(reaction.emoji);
    const dbUser = await prisma.user.findUnique({
      where: { discordId: user.id },
    });

    if (!dbUser) {
      logger.error("User not found in the database.");
      return;
    }

    // upsert PostReaction in any other case (user didnt post WM emoji, user has power role, etc.)
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

    if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
      await handleElevatedReaction(
        reaction,
        dbUser,
        post,
        emoji,
        dbReaction,
        user
      );
    }
  } catch (error) {
    logger.error("Error querying the database for the post:", error);
    return;
  }
}

export async function handleElevatedReaction(
  reaction: MessageReaction,
  user: User,
  post: Post & { categories: Category[] },
  emoji: Emoji,
  dbReaction: Reaction,
  discordUser: DiscordUser
) {
  const postId = reaction.message.id; // Assuming message ID is used as post ID

  try {
    // Check for Payment Rule
    const paymentRule = await prisma.paymentRule.findUnique({
      where: { emojiId: emoji.id },
    });

    if (paymentRule) {
      // first check if the post is complete before publishing it by adding the payment emoji

      const isPostIncomplete = await handlePostIncomplete(
        post,
        discordUser,
        reaction
      );

      // if the post is complete, process the payment rule (=add payment and publish post)
      if (!isPostIncomplete) {
        await handlePaymentRule(post, user.id, paymentRule, dbReaction);
      }

      return;
    }

    // Check for Category Rule
    const categoryRule = await prisma.categoryRule.findUnique({
      where: { emojiId: emoji.id },
      include: { category: true },
    });

    if (categoryRule) {
      await handleCategoryRule(postId, categoryRule);
      return;
    }

    // Check for Feature Rule
    if (emoji.name === config.FEATURE_EMOJI) {
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
  // make sure the post has a category
  const postCategories = post.categories;
  if (postCategories.length === 0) {
    const messageLink = `https://discord.com/channels/${reaction.message.guild?.id}/${reaction.message.channel.id}/${reaction.message.id}`;
    await discordUser.send(
      `Before you can publish the post ${messageLink}, make sure it has a category.`
    );
    logger.log(
      `Informed ${discordUser.tag} about the post not having a category.`
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }
}

async function handlePaymentRule(
  post: Post & { categories: Category[] },
  userId: number,
  paymentRule: PaymentRule,
  reaction: Reaction
) {
  const amount = paymentRule.paymentAmount;

  await prisma.payment.upsert({
    where: {
      // Define unique identifier for payment, e.g., a combination of postId and userId
      postId_userId_reactionId: {
        postId: post.id,
        userId,
        reactionId: reaction.id,
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
      reactionId: reaction.id, // Assuming you're storing the emojiId in the reaction
    },
  });

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

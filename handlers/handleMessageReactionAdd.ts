import { findOrCreateEmoji } from "@/data/emoji.js";
import { findOrCreatePost } from "@/data/post.js";
import { findOrCreateUser } from "@/data/user.js";
import { userHasRole } from "@/utils/userHasRole.js";
import {
  Category,
  PaymentRule,
  Post,
  PrismaClient,
  Reaction,
  User,
} from "@prisma/client";
import { Emoji, MessageReaction, User as DiscordUser } from "discord.js";
import * as config from "../config.js";

const prisma = new PrismaClient();

/**
 * Handle a reaction being added to a message. Perform checks if the user is authorized and the reaction is valid.
 * @param reaction
 * @param user
 * @returns
 */
export async function handleMessageReactionAdd(
  reaction: MessageReaction,
  user: DiscordUser
) {
  // Check if the reaction is in the channel we are interested in
  if (config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id)) {
    if (user.bot) return; // Ignore bot reactions
    if (!reaction.message.guild) return; // Ignore DMs

    console.log(
      `✅ new emoji: ${JSON.stringify(reaction.emoji.name)} by ${
        user.displayName
      }`
    );

    // make sure the message, reaction and user are cached
    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (error) {
        console.error(
          "Something went wrong when fetching the reaction:",
          error
        );
        return;
      }
    }

    if (reaction.message.partial) {
      try {
        await reaction.message.fetch();
      } catch (error) {
        console.error("Something went wrong when fetching the message:", error);
        return;
      }
    }

    // Check if the user has the power to react with WM emojis
    if (
      !userHasRole(reaction.message.guild, user, config.ROLES_WITH_POWER) &&
      reaction.emoji.name?.startsWith("WM")
    ) {
      const messageLink = `https://discord.com/channels/${reaction.message.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
      await user.send(
        `You do not have permission to add WagMedia emojis in ${messageLink}`
      );
      console.log(
        `Informed ${user.tag} about not having permission to use the emoji.`
      );
      await reaction.users.remove(user.id);
      return;
    }
    await handleReaction(reaction, user);
  }
}

export async function handleReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser
) {
  const postId = reaction.message.id; // Assuming message ID is used as post ID

  try {
    // ensure User exists
    const user = await findOrCreateUser(reaction.message);

    // ensure Post exists
    const post = await findOrCreatePost(reaction.message);

    // ensure Emoji exists
    const emoji = await findOrCreateEmoji(reaction.emoji);

    // upsert PostReaction
    const dbReaction = await prisma.reaction.upsert({
      where: {
        postId_userDiscordId_emojiId: {
          postId: post.id,
          emojiId: emoji.id,
          userDiscordId: user.discordId,
        },
      },
      update: {},
      create: {
        postId: post.id,
        emojiId: emoji.id,
        userDiscordId: user.discordId,
      },
    });

    // Check for Payment Rule
    const paymentRule = await prisma.paymentRule.findUnique({
      where: { emojiId: emoji.id },
    });

    if (paymentRule) {
      // first check if the post is complete before publishing it by adding the payment emoji
      const postCategories = post.categories;

      if (postCategories.length === 0) {
        const messageLink = `https://discord.com/channels/${reaction.message.guild?.id}/${reaction.message.channel.id}/${reaction.message.id}`;
        await discordUser.send(
          `Before you can publish the post ${messageLink}, make sure it has a category.`
        );
        console.log(
          `Informed ${discordUser.tag} about the post not having a category.`
        );
        await reaction.users.remove(discordUser.id);
      } else {
        await handlePaymentRule(post, user.id, paymentRule, dbReaction);
      }

      return;
    }

    // Check for Category Rule
    const categoryRule = await prisma.categoryRule.findUnique({
      where: { emojiId: emoji.id },
    });

    if (categoryRule) {
      await handleCategoryRule(postId, categoryRule.categoryId);
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

    console.log("No action rule found for this reaction.");
  } catch (error) {
    console.error("Error processing reaction:", error);
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

  console.log(
    `Payment rule processed for post ${post.id}: new total earnings ${updatedEarnings}`
  );
}

async function handleCategoryRule(postId: string, categoryId: number) {
  await prisma.post.update({
    where: { id: postId },
    data: {
      categories: {
        connect: { id: categoryId },
      },
    },
  });

  console.log(`Category rule processed for post ${postId}`);
}

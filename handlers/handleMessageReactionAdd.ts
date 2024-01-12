import { EmojiAction } from "@/config.js";
import { findOrCreateEmoji } from "@/data/emoji.js";
import { findOrCreatePost } from "@/data/post.js";
import { findOrCreateUser } from "@/data/user.js";
import { userHasRole } from "@/utils/userHasRole.js";
import { PrismaClient, Reaction, User } from "@prisma/client";
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
      `✅ new emoji: ${JSON.stringify(reaction.emoji)} by ${user.displayName}`
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
      !userHasRole(reaction.message.guild, user, config.rolesWithPower) &&
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
  user: DiscordUser
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
    console.log("payment rule", paymentRule);

    if (paymentRule) {
      await handlePaymentRule(
        postId,
        user.id,
        paymentRule.paymentAmount,
        dbReaction
      );
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

    console.log("No action rule found for this reaction.");
  } catch (error) {
    console.error("Error processing reaction:", error);
  }

  // try {
  //   // ensure User exists
  //   const user = await findOrCreateUser(reaction.message);

  //   // ensure Post exists
  //   const post = await findOrCreatePost(reaction.message);

  //   // ensure Emoji exists
  //   const emoji = await findOrCreateEmoji(reaction.emoji);

  //   // upsert PostReaction
  //   await prisma.reaction.upsert({
  //     where: {
  //       postId_userDiscordId_emojiId: {
  //         postId: post.id,
  //         emojiId: emoji.id,
  //         userDiscordId: user.discordId,
  //       },
  //     },
  //     update: {},
  //     create: {
  //       postId: post.id,
  //       emojiId: emoji.id,
  //       userDiscordId: user.discordId,
  //     },
  //   });

  // const emojiAction = emoji.action;
  // if (emojiAction) {
  //   await performEmojiAction(emojiAction, reaction, user);
  // }
  // } catch (error) {
  //   console.error("Error processing reaction:", error);
  // }
}

async function handlePaymentRule(
  postId: string,
  userId: number,
  amount: number,
  reaction: Reaction
) {
  // Logic to handle payment rule
  // For example, create or update a payment record
  await prisma.payment.upsert({
    where: {
      // Define unique identifier for payment, e.g., a combination of postId and userId
      postId_userId_reactionId: { postId, userId, reactionId: reaction.id },
    },
    update: {
      amount, // Update the payment amount or any other necessary fields
    },
    create: {
      postId,
      userId,
      amount,
      status: "unknown", // initial payment status
      reactionId: reaction.id, // Assuming you're storing the emojiId in the reaction
    },
  });
  console.log(`Payment rule processed for post ${postId}`);
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

// import { PrismaClient } from '@prisma/client';

// const prisma = new PrismaClient();

// async function handleReaction(postId: string, emojiId: string, userId: number) {
//   // Fetch the payment rule for the given emoji
//   const paymentRule = await prisma.paymentRule.findUnique({
//     where: { emojiId },
//   });

//   if (!paymentRule) {
//     console.log("No payment rule for this emoji.");
//     return;
//   }

//   // Check if the post is eligible for payment
//   const post = await prisma.post.findUnique({
//     where: { id: postId },
//     include: { reactions: true },
//   });

//   if (!post || !post.isEligibleForPayment) {
//     console.log("Post is not eligible for payment.");
//     return;
//   }

//   // Check if the user has already reacted to this post with this emoji
//   if (post.reactions.some(reaction => reaction.emojiId === emojiId && reaction.userId === userId)) {
//     console.log("User has already reacted with this emoji.");
//     return;
//   }

//   // Process the payment
//   const paymentAmount = paymentRule.paymentAmount;
//   await processPayment(postId, userId, paymentAmount);

//   // Update the post's total earnings
//   const updatedEarnings = (post.totalEarnings || 0) + paymentAmount;
//   await prisma.post.update({
//     where: { id: postId },
//     data: { totalEarnings: updatedEarnings },
//   });

//   console.log(`Processed payment of ${paymentAmount} for post ${postId}`);
// }

// async function processPayment(postId: string, userId: number, amount: number) {
//   // Implement the logic to process the payment
//   // This could involve external payment services, internal accounting, etc.

//   // For demonstration, let's create a Payment record
//   await prisma.payment.create({
//     data: {
//       amount,
//       status: 'completed', // or 'pending', based on your payment processing
//       postId,
//       userId,
//     },
//   });
// }

// // Example usage
// handleReaction('some-post-id', 'emoji-id-for-payment', 123);

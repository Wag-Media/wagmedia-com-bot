import { EmojiAction } from "@/config.js";
import { findOrCreateEmoji } from "@/data/emoji.js";
import { findOrCreatePost } from "@/data/post.js";
import { findOrCreateUser } from "@/data/user.js";
import { userHasRole } from "@/utils/userHasRole.js";
import { PrismaClient, User } from "@prisma/client";
import { Emoji, MessageReaction, User as DiscordUser } from "discord.js";
import * as config from "../config.js";

const prisma = new PrismaClient();

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
  }

  await handleReaction(reaction, user);
}

export async function handleReaction(
  reaction: MessageReaction,
  user: DiscordUser
) {
  // Ensure related records exist
  let emojiIdentifier = reaction.emoji.id || reaction.emoji.name; // Handle both custom and Unicode emojis
  if (!emojiIdentifier) {
    throw new Error("No emoji found in the reaction");
  }

  try {
    // ensure User exists
    const user = await findOrCreateUser(reaction.message);

    // ensure Post exists
    const post = await findOrCreatePost(reaction.message);

    // ensure Emoji exists
    const emoji = await findOrCreateEmoji(reaction.emoji);

    // upsert PostReaction
    await prisma.reaction.upsert({
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

    // const emojiAction = emoji.action;
    // if (emojiAction) {
    //   await performEmojiAction(emojiAction, reaction, user);
    // }
  } catch (error) {
    console.error("Error processing reaction:", error);
  }
}

function isValidAction(action: string): boolean {
  return Object.values(EmojiAction).includes(action as EmojiAction);
}

async function performEmojiAction(
  action: string,
  reaction: MessageReaction,
  user: User
) {
  if (!isValidAction(action)) {
    console.error(`Invalid action: ${action}`);
    return;
  }

  const emoji = reaction.emoji;

  switch (action) {
    case EmojiAction.publish:
      console.log("post published", reaction.message.id);
      await prisma.post.update({
        where: {
          id: reaction.message.id,
        },
        data: {
          isPublished: true,
        },
      });

      break;
    case EmojiAction.addCategory:
      console.log("added category to", reaction.message.id);
      await prisma.post.update({
        where: {
          id: reaction.message.id,
        },
        data: {
          categories: {
            connect: {
              emojiId: emoji.name || emoji.id!,
            },
          },
        },
      });
      break;

    case EmojiAction.feature:
      console.log("featured post", reaction.message.id);
      await prisma.post.update({
        where: {
          id: reaction.message.id,
        },
        data: {
          isFeatured: true,
        },
      });
      break;
    default:
      console.error(`Invalid action: ${action}`);
  }
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

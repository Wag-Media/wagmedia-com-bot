import {
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji";
import { userHasRole } from "@/utils/userHasRole.js";
import {
  Category,
  CategoryRule,
  ContentEarnings,
  Emoji,
  OddJob,
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
  Message,
  messageLink,
} from "discord.js";

import { logger } from "@/client";
import {
  ensureFullEntities,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForPosts,
  isChannelMonitoredForOddJobs,
  isParentMessageFromMonitoredCategoryOrChannel,
  shouldIgnoreReaction,
} from "./util.js";
import {
  fetchPost,
  findOrCreatePost,
  findOrCreateThreadPost,
} from "@/data/post.js";
import {
  logNewEmojiReceived,
  logNewRegularUserEmojiReceived,
  logOddjobEarnings,
  logPostEarnings,
} from "./log-utils.js";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { upsertOddjobReaction, upsertPostReaction } from "@/data/reaction";
import { isCountryFlag } from "../utils/is-country-flag.js";
import { fetchOddjob } from "@/data/oddjob";
import { parseOddjob } from "@/utils/handle-odd-job";
import { isPaymentReactionValid } from "@/utils/payment-valid";

import * as config from "@/config";
import { all } from "axios";

const prisma = new PrismaClient();

/**
 * Handle a reaction being added to a message. Perform checks if the user is authorized and the reaction is valid.
 * @param reaction
 * @param user
 * @returns
 */
export async function handleMessageReactionAdd(
  reaction: MessageReaction | PartialMessageReaction,
  user: DiscordUser | PartialUser,
) {
  // make sure the message, reaction and user are cached
  try {
    const fullEntities = await ensureFullEntities(reaction, user);
    reaction = fullEntities.reaction;
    user = fullEntities.user;
  } catch (error) {
    logger.error("Error ensuring full entities:", error);
    return;
  }

  if (shouldIgnoreReaction(reaction)) return;

  // guild is not null because we checked for it in shouldIgnoreReaction
  const guild = reaction.message.guild!;
  const messageLink = `https://discord.com/channels/${guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

  // reactions to threads
  if (isParentMessageFromMonitoredCategoryOrChannel(reaction.message)) {
    if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
      if (!reaction.message.channel.isThread()) {
        logger.warn(
          `The message ${messageLink} is not a thread, but it passed the checks.`,
        );
        return;
      }

      const dbEmoji: Emoji = await findOrCreateEmoji(reaction.emoji);
      const paymentRule: PaymentRule | null = await findEmojiPaymentRule(
        dbEmoji.id,
      );

      if (!paymentRule) {
        console.log("ignoring non payment emojis in thread");
        return;
      }

      // upsert the user who reacted
      const dbUser = await findOrCreateUserFromDiscordUser(user);
      const parentId = reaction.message.channel.id;

      const parentPost = await prisma.post.findUnique({
        where: { id: parentId, isPublished: true },
      });

      if (!parentPost) {
        logger.logAndSend(
          `Parent post is not in the database or not published yet. ${messageLink}. Payments are not possible for reviewers in this case`,
          user,
          "warn",
        );
        await reaction.users.remove(user.id);
        return;
      }

      const threadedPost = await findOrCreateThreadPost({
        message: reaction.message,
        content: reaction.message.content || "",
        url: messageLink,
      });

      const dbReaction = await prisma.reaction.create({
        data: {
          emojiId: dbEmoji.id,
          userDiscordId: dbUser.discordId,
          postId: threadedPost.id,
        },
      });

      await prisma.contentEarnings.upsert({
        where: {
          postId_unit: {
            postId: threadedPost.id,
            unit: paymentRule.paymentUnit,
          },
        },
        update: {
          totalAmount: {
            increment: paymentRule.paymentAmount,
          },
        },
        create: {
          postId: threadedPost.id,
          unit: paymentRule.paymentUnit,
          totalAmount: paymentRule.paymentAmount,
        },
      });

      await prisma.payment.create({
        data: {
          amount: paymentRule.paymentAmount,
          unit: paymentRule.paymentUnit,
          fundingSource: paymentRule.fundingSource,
          threadParentId: parentId,
          postId: threadedPost.id,
          userId: dbUser.id,
          reactionId: dbReaction.id,
          status: "unknown", // TODO: implement payment status
        },
      });

      logPostEarnings(threadedPost, messageLink);
    }
  }

  if (
    isCategoryMonitoredForPosts(reaction.message.channel) ||
    isChannelMonitoredForPosts(reaction.message.channel)
  ) {
    //TODO record the channel information of the message
    // console.log("channel", reaction.message.channel);
    try {
      const post = await fetchPost(reaction);
      if (!post || post.isDeleted) {
        await user.send(
          `The post ${messageLink} you reacted to is not valid (e.g. no title / description).`,
        );
        logger.log(
          `Informed ${user.tag} about the post ${messageLink} not being valid.`,
        );
        await reaction.users.remove(user.id);
        return;
      }

      //TODO this is also done in oddjobs, can be refactored
      const dbEmoji = await findOrCreateEmoji(reaction.emoji);

      // upsert the user who reacted
      const dbUser = await findOrCreateUserFromDiscordUser(user);
      if (!dbUser) {
        logger.error("User not found in the database.");
        return;
      }

      if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
        await processSuperuserPostReaction(
          reaction,
          user,
          dbUser,
          post,
          dbEmoji,
          messageLink,
        );
      } else {
        await processRegularUserPostReaction(
          reaction,
          user,
          dbUser,
          post,
          dbEmoji,
          messageLink,
        );
      }
    } catch (error) {
      logger.error("Error querying the database for the post:", error);
      return;
    }
  } else if (isChannelMonitoredForOddJobs(reaction.message.channel)) {
    if (!userHasRole(guild, user, config.ROLES_WITH_POWER)) {
      await user.send(
        `You do not have permission to add reactions to odd jobs in ${messageLink}`,
      );
      logger.log(
        `Informed ${user.tag} about not having permission to add reactions in ${messageLink}`,
      );
      await reaction.users.remove(user.id);
      return;
    }

    const oddJob = parseOddjob(
      reaction.message.content || "",
      reaction.message.mentions,
      reaction.message.attachments,
    );

    if (!oddJob) {
      await user.send(
        `The oddjob ${messageLink} you reacted to is not valid - not in the correct format. Please correct it before adding emojis`,
      );
      logger.log(
        `Informed ${user.tag} about the post ${messageLink} not being valid.`,
      );
      await reaction.users.remove(user.id);
      return;
    }

    processSuperuserOddJobReaction(reaction, user, messageLink);
  }
}

export async function processSuperuserOddJobReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  messageLink: string,
) {
  const oddjob = await fetchOddjob(reaction);

  if (!oddjob) {
    logger.logAndSend(
      `The oddjob ${messageLink} you reacted to is not valid - not in the correct format. Please correct it before adding emojis`,
      discordUser,
    );
    await reaction.users.remove(discordUser.id);
    return;
  }

  const dbEmoji = await findOrCreateEmoji(reaction.emoji);

  // upsert the user who reacted
  const dbUser = await findOrCreateUserFromDiscordUser(discordUser);
  const dbReaction = await upsertOddjobReaction(oddjob, dbUser, dbEmoji);

  const paymentRule = await findEmojiPaymentRule(dbEmoji.id);

  if (paymentRule) {
    // if the manager is not the user who reacted, remove the reaction
    if (oddjob.managerId !== dbUser.discordId) {
      logger.logAndSend(
        `You do not have permission to add payment reactions in ${messageLink}, only the assigned manager can do that.`,
        discordUser,
      );
      await reaction.users.remove(discordUser.id);
      return;
    }

    // everything is a full entity so we can use the message as a message
    const valid = await isPaymentReactionValid(
      reaction.message as Message,
      reaction,
      messageLink,
    );
    if (valid) {
      handleOddjobPaymentRule(
        oddjob,
        dbUser.id,
        paymentRule,
        dbReaction.id,
        messageLink,
      );
    } else {
      logger.logAndSend(
        `You do not have permission to add payment reactions in ${messageLink}, that differ from the first payment unit and funding source.`,
        discordUser,
      );
      await reaction.users.remove(discordUser.id);
    }
  }
}

export async function processRegularUserPostReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: (Post & { categories: Category[] }) | null,
  dbEmoji: Emoji,
  messageLink: string,
) {
  if (!post) {
    logger.log(
      `Ignoring user reaction to post ${messageLink}, as it is not valid.`,
    );
    return;
  } else if (reaction.emoji.name?.includes("WM")) {
    // Remove WM emojis if the user does not have the power role
    logger.logAndSend(
      `You do not have permission to add WagMedia emojis in ${messageLink}`,
      discordUser,
    );
    await reaction.users.remove(discordUser.id);
  } else if (isCountryFlag(reaction.emoji.name)) {
    logger.logAndSend(
      `You do not have permission to add country flag emojis in ${messageLink}`,
      discordUser,
    );
    await reaction.users.remove(discordUser.id);
  } else {
    await upsertPostReaction(post, dbUser, dbEmoji);
    logNewRegularUserEmojiReceived(reaction, discordUser, messageLink);
  }
}

export async function processSuperuserPostReaction(
  reaction: MessageReaction,
  discordUser: DiscordUser,
  dbUser: User,
  post: Post & { categories: Category[] } & { earnings: ContentEarnings[] },
  dbEmoji: Emoji,
  messageLink: string,
) {
  const postId = reaction.message.id;
  const dbReaction = await upsertPostReaction(post, dbUser, dbEmoji);
  logNewEmojiReceived(reaction, discordUser, messageLink);

  // process possible rules for the emoji
  // 0. Deleted Posts
  // 1. Category Rule
  // 2. Payment Rule
  // 3. Feature Rule

  if (post.isDeleted) {
    logger.logAndSend(
      `The post ${messageLink} you reacted to is not valid, skipping processing superuser reactions.`,
      discordUser,
    );
    await reaction.users.remove(discordUser.id);
    return;
  }

  try {
    // 1. Check for Category Rule
    const categoryRule = await findEmojiCategoryRule(dbEmoji.id);
    if (categoryRule) {
      await handleCategoryRule(reaction, postId, categoryRule, messageLink);
      return;
    }

    // 2. Check for Payment Rule
    const paymentRule = await findEmojiPaymentRule(dbEmoji.id);
    if (paymentRule) {
      // first check if the post is complete before publishing it by adding the payment emoji
      const isPostIncomplete = await handlePostIncomplete(
        post,
        discordUser,
        reaction,
      );

      // if the post is complete, process the payment rule (=add payment and publish post)
      if (!isPostIncomplete) {
        const valid = await isPaymentReactionValid(
          reaction.message as Message,
          reaction,
          messageLink,
        );
        if (valid) {
          await handlePostPaymentRule(
            post!,
            dbUser.id,
            paymentRule,
            dbReaction.id,
            messageLink,
          );
        } else {
          logger.logAndSend(
            `You do not have permission to add payment reactions in ${messageLink}, that differ from the first payment unit and funding source.`,
            discordUser,
          );
          await reaction.users.remove(discordUser.id);
        }
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
  reaction: MessageReaction,
) {
  const postCategories = post.categories;
  const messageLink = `https://discord.com/channels/${reaction.message.guild?.id}/${reaction.message.channel.id}/${reaction.message.id}`;

  // 0. make sure the post is not flagged as deleted
  if (post.isDeleted) {
    await logger.logAndSend(
      `The post ${messageLink} you reacted to is deleted and cannot be published. `,
      discordUser,
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  // 0. make sure the post has a title and description
  if (!post.title || !post.content) {
    await discordUser.send(
      `Before you can publish the post ${messageLink}, make sure it has a title and description.`,
    );
    logger.log(
      `Informed ${discordUser.tag} about the post not having a title or description when trying to publish.`,
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  // 1. make sure the post has a category
  if (postCategories.length === 0) {
    await discordUser.send(
      `Before you can publish the post ${messageLink}, make sure it has a category.`,
    );
    logger.log(
      `Informed ${discordUser.tag} about the post not having a category when trying to publish.`,
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  // 2. make sure non anglo posts have a flag
  const isNonAnglo = postCategories.some((category) =>
    category.name.includes("Non Anglo"),
  );

  if (isNonAnglo) {
    //get post reactions
    const postReactions = await prisma.reaction.findMany({
      where: { postId: post.id },
      include: { emoji: true },
    });

    // check if the post has a flag
    const hasFlag = postReactions.some((reaction) =>
      isCountryFlag(reaction.emoji?.id),
    );

    if (!hasFlag) {
      await discordUser.send(
        `Before you can publish the post ${messageLink}, with non-anglo category, make sure it has a flag.`,
      );
      logger.log(
        `Informed ${discordUser.tag} about the post not having a flag when trying to publish.`,
      );
      await reaction.users.remove(discordUser.id);
      return true;
    }
  }

  // 3. make sure translation posts have a non anglo category
  const isTranslation = postCategories.some((category) =>
    category.name.includes("Translations"),
  );

  if (isTranslation && !isNonAnglo) {
    await discordUser.send(
      `Before you can publish the post ${messageLink} with a translation category, make sure it also has a Non Anglo category.`,
    );
    logger.log(
      `Informed ${discordUser.tag} about a translated post not having a Non Anglo category when trying to publish.`,
    );
    await reaction.users.remove(discordUser.id);
    return true;
  }

  return false;
}

async function handleOddjobPaymentRule(
  oddjob: OddJob & { earnings: ContentEarnings[] },
  userId: number,
  paymentRule: PaymentRule,
  reactionId: number,
  messageLink,
) {
  const amount = paymentRule.paymentAmount;
  const unit = paymentRule.paymentUnit;

  // add or update the post earnings (this is adding redundancy but makes querying easier)
  await prisma.contentEarnings.upsert({
    where: {
      oddJobId_unit: {
        oddJobId: oddjob.id,
        unit,
      },
    },
    update: {
      totalAmount: {
        increment: amount,
      },
    },
    create: {
      oddJobId: oddjob.id,
      unit,
      totalAmount: amount,
    },
  });

  // Insert a payment record
  await prisma.payment.create({
    data: {
      amount: amount,
      unit: unit,
      fundingSource: paymentRule.fundingSource,
      oddJobId: oddjob.id,
      reactionId: reactionId,
      status: "unknown", // TODO: implement payment status
      userId,
    },
  });

  logger.log(`Payment rule processed for oddjob.`);

  logOddjobEarnings(oddjob, messageLink);
}

async function handlePostPaymentRule(
  post: Post & { categories: Category[] } & { earnings: ContentEarnings[] },
  userId: number,
  paymentRule: PaymentRule,
  reactionId: number,
  messageLink: string,
) {
  const amount = paymentRule.paymentAmount;
  const unit = paymentRule.paymentUnit;

  const postTotalEarningsInUnit = post.earnings.find(
    (e) => e.unit === unit,
  )?.totalAmount;

  if (!postTotalEarningsInUnit) {
    logger.log(`[post] The post ${messageLink} has been published.`);
  }

  // add or update the post earnings (this is adding redundancy but makes querying easier)
  await prisma.contentEarnings.upsert({
    where: {
      postId_unit: {
        postId: post.id,
        unit,
      },
    },
    update: {
      totalAmount: {
        increment: amount,
      },
    },
    create: {
      postId: post.id,
      unit,
      totalAmount: amount,
    },
  });

  // Insert a payment record
  await prisma.payment.create({
    data: {
      amount: amount,
      unit: unit,
      fundingSource: paymentRule.fundingSource,
      postId: post.id,
      userId: userId,
      reactionId: reactionId,
      status: "unknown", // TODO: implement payment status
    },
  });

  // Update the post to set isPublished to true
  await prisma.post.update({
    where: { id: post.id },
    data: { isPublished: true },
  });

  logPostEarnings(post, messageLink);
}

async function handleCategoryRule(
  reaction: MessageReaction,
  postId: string,
  categoryRule: CategoryRule & { category: Category },
  messageLink: string,
) {
  // make sure the message is cached
  const message = reaction.message;

  // fetch all category emojis from the message
  const allCategories = await prisma.category.findMany();
  const messageCategoryCount = message.reactions.cache.filter((r) =>
    allCategories.some((c) => c.emojiId === r.emoji.name),
  ).size;

  // if the count of the post's categories is 1, we can connect the post with the added
  // category and remove all other categories. This can happen in an edge case where the
  // user removed the last category of a published post and then added a new category.
  if (messageCategoryCount === 1) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        categories: {
          set: [{ id: categoryRule.categoryId }],
        },
      },
    });
  } else {
    // connect the post with the added category
    await prisma.post.update({
      where: { id: postId },
      data: {
        categories: {
          connect: { id: categoryRule.categoryId },
        },
      },
    });
  }

  logger.log(
    `[category] Category ${categoryRule.category.name} added to ${messageLink}.`,
  );
}

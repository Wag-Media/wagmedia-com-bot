import {
  classifyMessage,
  classifyReaction,
  ensureFullMessage,
  getGuildFromMessage,
  shouldIgnoreMessage,
} from "@/handlers/util";
import { handleOddJob } from "@/utils/handle-odd-job";
import { PostType, handlePost, parseMessage } from "@/utils/handle-post";
import { userHasRole } from "@/utils/userHasRole";
import {
  Emoji,
  OddJob,
  PaymentRule,
  Post,
  Reaction,
  User,
} from "@prisma/client";
import {
  Channel,
  Message,
  User as DiscordUser,
  MessageReaction,
  Guild,
  Collection,
} from "discord.js";

import * as config from "@/config";
import {
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji";
import {
  addCategory,
  fetchPost,
  findOrCreatePost,
  getPost,
  getPostReactionCount,
  getPostWithEarnings,
  removeCategoryFromPost,
  resetPostReactions,
} from "@/data/post";
import { Type } from "typescript";
import { discordClient, logger } from "@/client";
import { PostWithCategories, ReactionEvent, emojiType } from "@/types";
import {
  deleteReaction,
  getPostReactions,
  upsertReaction,
} from "@/data/reaction";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { MessageCurator } from "@/curators/message-curator";
import { prisma } from "@/utils/prisma";
import { isCountryFlag } from "@/utils/is-country-flag";
import { getOddJob } from "@/data/oddjob";
import { logPostEarnings } from "@/handlers/log-utils";
import { ReactionTracker } from "@/reaction-tracker";

export class ReactionCurator {
  private static handlingDiscrepancy: boolean = false;
  private static reaction: MessageReaction;
  private static dbReaction: Reaction | undefined | null;
  private static dbEmoji: Emoji;
  private static emojiType: emojiType;
  private static discordUser: DiscordUser;
  private static dbUser: User | undefined;
  private static message: Message;
  private static messageLink: string | undefined;
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static dbMessage: PostWithCategories | OddJob | null | undefined;
  private static parentId: string | undefined;
  private static isReactionFromPowerUser: boolean = false;
  private static guild: Guild | null;

  private static async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    this.reaction = reaction;
    this.discordUser = user;
    this.message = (await ensureFullMessage(reaction.message)).message;

    if (shouldIgnoreMessage(this.message)) {
      logger.warn("Message is to be ignored. Skipping reaction curation.");
      throw new Error("Message is to be ignored");
    }

    if (!this.handlingDiscrepancy) {
      this.guild = await getGuildFromMessage(this.message);
      this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
      const classifiedMessage = classifyMessage(this.message);
      this.messageChannelType = classifiedMessage.messageChannelType;
      this.parentId = classifiedMessage.parentId;

      // Fetch the message from the database if it exists
      if (this.messageChannelType === "post") {
        this.dbMessage = await getPost(this.message.id);
      } else if (this.messageChannelType === "oddjob") {
        this.dbMessage = await getOddJob(this.message.id);
      }

      if (!this.dbMessage) {
        logger.warn("Message not found in the database.");
        //todo remove the waspartial logic here
        this.dbMessage = await MessageCurator.curate(this.message, false);
      }
    }
    this.dbUser = await findOrCreateUserFromDiscordUser(this.discordUser);
    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    this.emojiType = await classifyReaction(this.dbEmoji);
    this.dbMessage = await fetchPost(this.reaction);

    if (!this.guild) {
      throw new Error("Guild is not defined");
    }
    this.isReactionFromPowerUser = userHasRole(
      this.guild,
      user,
      config.ROLES_WITH_POWER
    );
  }

  public static async curateAdd(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    try {
      await this.initialize(reaction, user);
    } catch (error) {
      logger.error("Error in reaction curation initialization:", error);
      return;
    }

    if (!this.handlingDiscrepancy) {
      const discrepancyDetected = await this.detectDiscrepancy();
      if (discrepancyDetected) {
        this.handlingDiscrepancy = true;
        await this.reconcileReactions(reaction.message.reactions.cache);
        this.handlingDiscrepancy = false;
        return;
      }
    }

    // this is the main logic of the reaction curation that will only
    // be executed if not handling a discrepancy
    try {
      await this.isReactionAddPermitted();

      if (this.messageChannelType === "post") {
        await this.curatePostReactionAdd();
      } else if (this.messageChannelType === "oddjob") {
        await this.curateOddJobReactionAdd();
      } else if (this.parentId) {
        await this.curateThreadReactionAdd();
      } else {
        logger.warn("Message type not recognized. Skipping reaction curation.");
      }
    } catch (error) {
      logger.error(
        `Error in reaction curation for ${this.messageLink} and emoji ${
          this.dbEmoji.name || this.dbEmoji.id
        }: ${error.message}`
      );

      // If any error occurs, remove the reaction from from discord
      console.log(
        "because an error occored, bot will remove the reaction",
        this.reaction.emoji.name || this.reaction.emoji.id
      );

      ReactionTracker.addReactionToTrack(reaction);
      await this.reaction.users.remove(this.discordUser.id);
      this.curateRemove(reaction, user);
    }
  }

  static async curatePostReactionAdd() {
    if (!this.dbUser) {
      throw new Error("dbUser is not defined");
    }
    if (!this.dbEmoji) {
      throw new Error("dbEmoji is not defined");
    }
    if (!this.dbMessage) {
      throw new Error("post is not defined");
    }

    if (this.isReactionFromPowerUser) {
      await this.curatePowerUserPostReactionAdd();
    } else {
      await this.curateRegularUserPostReactionAdd();
    }
  }

  static async curateOddJobReactionAdd() {
    // TODO
  }

  static async curateThreadReactionAdd() {
    if (!this.isReactionFromPowerUser) {
      return;
    }
  }

  static async curatePowerUserPostReactionAdd() {
    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertReaction(dbPost, this.dbUser!, this.dbEmoji);

    switch (this.emojiType) {
      case "category":
        await this.handleAddCategoryRule();
        break;
      case "payment":
        await this.handleAddPaymentRule();
        break;
      case "feature":
        await this.handleAddFeatureRule();
        break;
      default:
        //nothing special to do for regular emojis as already handled in curatePostReaction
        break;
    }
  }

  private static async handleAddCategoryRule() {
    const categoryRule = await findEmojiCategoryRule(this.dbEmoji.id);
    if (!categoryRule) {
      throw new Error("Category rule not found");
    }

    // update the local dbMessage with the new category
    this.dbMessage = await addCategory(
      this.message.id,
      categoryRule.category.id
    );

    logger.log(
      `[category] Category ${categoryRule.category.name} added to ${this.messageLink}.`
    );
  }

  private static async handleAddPaymentRule() {
    console.log("handling add payment rule", this.dbEmoji.id);

    // Retrieve the payment rule for the reaction emoji
    const paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);

    if (!paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    if (!(await this.isPaymentReactionValid(paymentRule))) {
      throw new Error(`Payment reaction for ${this.messageLink} is not valid.`);
    }

    const amount = paymentRule.paymentAmount;
    const unit = paymentRule.paymentUnit;

    const post = await getPostWithEarnings(this.message.id);
    if (!post) {
      throw new Error(`Post for ${this.messageLink} not found.`);
    }

    const postTotalEarningsInUnit = post.earnings.find(
      (e) => e.unit === unit
    )?.totalAmount;

    // if (!postTotalEarningsInUnit) {
    //   logger.log(`[post] The post ${this.messageLink} has been published.`);
    // }

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

    if (!this.dbUser) {
      throw new Error("dbUser is not defined");
    }
    if (!this.dbReaction) {
      throw new Error("dbReaction is not defined");
    }

    // Insert a payment record
    await prisma.payment.create({
      data: {
        amount: amount,
        unit: unit,
        fundingSource: paymentRule.fundingSource,
        postId: post.id,
        userId: this.dbUser.id,
        reactionId: this.dbReaction.id,
        status: "unknown", // TODO: implement payment status
      },
    });

    // Update the post to set isPublished to true
    if (!post.isPublished) {
      await prisma.post.update({
        where: { id: post.id },
        data: { isPublished: true },
      });
      logger.log(`[post] The post ${this.messageLink} has been published.`);
    }

    await logPostEarnings(post, this.messageLink || "");
  }

  static async handleAddFeatureRule() {
    logger.log(`[feature] TODO Feature rule added to ${this.messageLink}.`);
  }

  private static async curateRegularUserPostReactionAdd() {
    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertReaction(dbPost, this.dbUser!, this.dbEmoji);
  }

  public static async curateRemove(
    reaction: MessageReaction,
    user: DiscordUser
  ) {
    try {
      await this.initialize(reaction, user);
    } catch (error) {
      logger.error("Error in reaction curation initialization:", error);
      return;
    }

    // this is the main logic of the reaction curation that will only
    // be executed if not handling a discrepancy
    try {
      await this.isReactionRemovePermitted();

      if (this.messageChannelType === "post") {
        await this.curatePostReactionRemove();
      } else if (this.messageChannelType === "oddjob") {
        await this.curateOddJobReactionRemove();
      } else if (this.parentId) {
        await this.curateThreadReactionRemove();
      } else {
        logger.warn("Message type not recognized. Skipping reaction curation.");
      }
    } catch (error) {
      logger.error(
        `Error in reaction curation for ${this.messageLink} and emoji ${
          this.dbEmoji.name || this.dbEmoji.id
        }: ${error.message}`
      );

      // If any error occurs, remove the reaction from from discord
      console.log(
        "because an error occored, bot will remove the reaction",
        this.reaction.emoji.name || this.reaction.emoji.id
      );

      await this.reaction.users.remove(this.discordUser.id);
    }
  }

  private static async curatePostReactionRemove() {
    if (!this.dbUser) {
      throw new Error("dbUser is not defined");
    }
    if (!this.dbEmoji) {
      throw new Error("dbEmoji is not defined");
    }
    if (!this.dbMessage) {
      throw new Error("post is not defined");
    }

    if (this.isReactionFromPowerUser) {
      await this.curatePowerUserPostReactionRemove();
    } else {
      await this.curateRegularUserPostReactionRemove();
    }

    // Additional tasks for special emojis can be handled here
  }

  private static async curatePowerUserPostReactionRemove() {
    this.dbReaction = await prisma.reaction.findFirst({
      where: {
        userDiscordId: this.dbUser!.discordId,
        postId: this.dbMessage!.id,
        emojiId: this.dbEmoji.id,
      },
    });

    if (!this.dbReaction) {
      throw new Error("Reaction to remove not found in the db");
    }

    await prisma.reaction.delete({
      where: {
        id: this.dbReaction.id,
      },
    });

    switch (this.emojiType) {
      case "category":
        await this.handleRemoveCategoryRule();
        break;
      case "payment":
        await this.handleRemovePaymentRule();
        break;
      case "feature":
        await this.handleRemoveFeatureRule();
        break;
      default:
        //nothing special to do for regular emojis as already handled
        break;
    }
  }

  private static async handleRemoveCategoryRule() {
    const categoryRule = await findEmojiCategoryRule(this.dbEmoji.id);
    if (!categoryRule) {
      throw new Error("Category rule not found");
    }

    if (!this.dbMessage) {
      throw new Error("dbMessage is not defined");
    }

    const post = this.dbMessage as PostWithCategories;

    //1. Check if the post has any remaining categories
    const remainingCategories = await prisma.category.findMany({
      where: { posts: { some: { id: post.id } } },
    });

    if (remainingCategories.length > 1) {
      await removeCategoryFromPost(post.id, categoryRule.categoryId);
      logger.log(
        `[category] Category ${categoryRule.category.name} removed from ${this.messageLink}.`
      );
      return;
    } else if (remainingCategories.length === 1) {
      if (post.isPublished) {
        logger.logAndSend(
          `🚨 The category ${categoryRule.category.name} has been removed from the post ${this.messageLink}. The post has no remaining but will keep its last category in the db / website until new categories are added.`,
          this.discordUser,
          "warn"
        );
      } else {
        await removeCategoryFromPost(post.id, categoryRule.categoryId);
      }
    }
  }

  private static async handleRemovePaymentRule() {
    console.log("handling remove payment rule", this.dbEmoji.id);

    const post = await getPostWithEarnings(this.message.id);
    if (!post) {
      throw new Error(`Post for ${this.messageLink} not found.`);
    }

    // Retrieve the payment rule for the reaction emoji
    const paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);

    if (!paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

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
        `[post] Post ${this.messageLink} has been unpublished due to no remaining payment emojis.`
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

    await logPostEarnings(post, this.messageLink || "");
  }

  private static async handleRemoveFeatureRule() {
    logger.log(`[feature] TODO Feature rule removed from ${this.messageLink}.`);
  }

  private static async curateRegularUserPostReactionRemove() {
    try {
      // dbEmoji.id is not null because we checked for it in getPostUserEmojiFromReaction
      await deleteReaction(
        this.dbMessage!.id,
        this.discordUser!.id,
        this.dbEmoji.id
      );
    } catch (error) {
      console.warn("Error in curateRegularUserPostReactionRemove:", error);
      return;
    }
  }

  private static async curateOddJobReactionRemove() {
    // TODO
  }

  private static async curateThreadReactionRemove() {
    // TODO
  }

  private static async removeReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    // Add logic to handle a reaction removal
    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertReaction(dbPost, this.dbUser!, this.dbEmoji);

    // Additional tasks for special emojis can be handled here
  }

  private static async reconcileReactions(
    messageReactions: Collection<string, MessageReaction>
  ): Promise<void> {
    // 1. remove all reactions and payments and soon to start fresh
    await resetPostReactions(this.message.id);

    // 2. iterate over all reactions and re-add them
    for (const [, messageReaction] of messageReactions) {
      console.log("iterate", messageReaction.emoji.name);
      let users = new Collection<string, DiscordUser>();
      try {
        users = await messageReaction.users.fetch();
      } catch (e) {
        console.error(e);
        continue;
      }
      for (const [, user] of users) {
        await this.curateAdd(messageReaction, user);
      }
    }
  }

  private static async detectDiscrepancy(): Promise<boolean> {
    if (!this.message.id) {
      return true;
    }

    const dbPost = await fetchPost(this.reaction);
    if (!dbPost) {
      logger.warn(
        `[post] Post with ID ${this.reaction.message.id} not found in the database.`
      );
      return true;
    }

    const dbPostReactionCount = await getPostReactionCount(this.message.id);
    if (dbPostReactionCount === undefined) {
      logger.warn(
        `[post] Post with ID ${this.reaction.message.id} has no reactions in the database.`
      );
      return true;
    }

    const postReactionCount = this.reaction.message.reactions.cache.size;

    if (postReactionCount !== dbPostReactionCount + 1) {
      logger.warn(
        `[post] Post with ID ${this.reaction.message.id} has a different number of reactions in the database.`,
        ` discord: ${postReactionCount - 1}`,
        ` db: ${dbPostReactionCount}`
      );
      return true;
    }

    return false;
  }

  private static async isReactionAddPermitted(): Promise<boolean> {
    // 0. regular users can only add regular emojis
    if (!this.isReactionFromPowerUser && this.emojiType !== "regular") {
      throw new Error(
        `Regular users cannot add ${this.emojiType} emojis to messages.`
      );
    }

    // 1. reactions can only be added to posts that are not deleted
    if (this.dbMessage?.isDeleted) {
      await logger.logAndSend(
        `The post ${this.messageLink} you reacted to is deleted and cannot be reacted to.`,
        this.discordUser
      );
      throw new Error("Post is deleted");
    }

    if (this.messageChannelType === "post") {
      const post = this.dbMessage as PostWithCategories;
      if (!post) {
        logger.warn("Post not found in the database.");
        throw new Error("Post not found");
      }

      if (this.emojiType === "payment") {
        // before adding a payment emoji:
        // 1.1. make sure the post has a title and description
        if (!post.title || !post.content) {
          logger.logAndSend(
            `Before you can publish the post ${this.messageLink}, make sure it has a title and description.`,
            this.discordUser
          );
          throw new Error("Post has no title or description");
        }

        // 1.2. make sure the post has a category
        if (post.categories.length === 0) {
          logger.logAndSend(
            `Before you can publish the post ${this.messageLink}, make sure it has a category.`,
            this.discordUser
          );
          throw new Error("Post has no category");
        }

        // 1.3. make sure non anglo posts have a flag
        const isNonAnglo = post.categories.some((category) =>
          category.name.includes("Non Anglo")
        );

        if (isNonAnglo) {
          //get post reactions
          const postReactions = await getPostReactions(this.message.id);

          // check if the post has a flag
          const hasFlag = postReactions.some((reaction) =>
            isCountryFlag(reaction.emoji?.id)
          );

          if (!hasFlag) {
            logger.logAndSend(
              `Before you can publish the post ${this.messageLink} with non anglo category, make sure it has a flag.`,
              this.discordUser
            );

            throw new Error("Post is non anglo and has no flag");
          }
        }

        // 3. make sure translation posts have a non anglo category
        const isTranslation = post.categories.some((category) =>
          category.name.includes("Translations")
        );

        if (isTranslation && !isNonAnglo) {
          logger.logAndSend(
            `Before you can publish the post ${this.messageLink} with a translation category, make sure it also has a Non Anglo category.`,
            this.discordUser
          );

          throw new Error("Post is translation and has no non anglo category");
        }
      }

      // when adding non anglo emoji, make sure the post has a flag
      if (post.isPublished && this.reaction.emoji.name === "WMNAO") {
        //get post reactions
        const postReactions = await getPostReactions(this.message.id);

        // check if the post has a flag
        const hasFlag = postReactions.some((reaction) =>
          isCountryFlag(reaction.emoji?.id)
        );

        if (!hasFlag) {
          logger.logAndSend(
            `Before you can add the non anglo emoji to the published post ${this.messageLink}, make sure it has a flag.`,
            this.discordUser
          );

          throw new Error("Post is non anglo and has no flag");
        }
      }
    }

    return true;
  }

  private static async isReactionRemovePermitted(): Promise<boolean> {
    //todo
    return true;
  }

  private static async isPaymentReactionValid(
    paymentRule: PaymentRule
  ): Promise<boolean> {
    const paymentCondition =
      this.messageChannelType === "post"
        ? { postId: this.message.id }
        : { oddJobId: this.message.id };

    // Fetch the first payment based on the determined entity type
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
        `Payment for ${this.messageLink} is valid because it is the first payment.`
      );
      return true;
    }

    console.log(
      `paymentRule.paymentUnit ${paymentRule.paymentUnit} firstPayment.unit ${firstPayment.reaction.emoji.name}`
    );

    console.log(
      `payment rule above is valid`,
      paymentRule.paymentUnit === firstPayment.unit &&
        paymentRule.fundingSource === firstPayment.fundingSource
    );

    // Validate the reaction's payment rule against the first payment's rule
    return (
      paymentRule.paymentUnit === firstPayment.unit &&
      paymentRule.fundingSource === firstPayment.fundingSource
    );
  }
}

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
  featurePost,
  fetchPost,
  findOrCreatePost,
  findOrCreateThreadPost,
  getPost,
  getPostOrOddjob,
  getPostOrOddjobReactionCount,
  getPostReactionCount,
  getPostWithEarnings,
  removeCategoryFromPost,
  resetPostOrOddjobReactions,
  resetPostReactions,
  unfeaturePost,
} from "@/data/post";
import { Type } from "typescript";
import { discordClient, logger } from "@/client";
import { PostWithCategories, ReactionEvent, emojiType } from "@/types";
import {
  deleteEntityReaction,
  deleteReaction,
  getPostReactions,
  upsertEntityReaction,
  upsertOddjobReaction,
  upsertPostReaction,
} from "@/data/reaction";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { MessageCurator } from "@/curators/message-curator";
import { prisma } from "@/utils/prisma";
import { isCountryFlag } from "@/utils/is-country-flag";
import { getOddJob, getOddjobWithEarnings } from "@/data/oddjob";
import { logContentEarnings } from "@/handlers/log-utils";
import { ReactionTracker } from "@/reaction-tracker";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

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
  private static parentId: string | null | undefined;
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

    console.log(
      "initialize",
      reaction.emoji.name || reaction.emoji.id,
      this.message.content
    );

    if (!this.handlingDiscrepancy) {
      this.guild = await getGuildFromMessage(this.message);
      this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
      const classifiedMessage = classifyMessage(this.message);

      console.log("classifiedMessage", classifiedMessage);
      this.messageChannelType = classifiedMessage.messageChannelType;
      this.parentId = classifiedMessage.parentId;

      // Fetch the message from the database if it exists
      if (this.messageChannelType === "post") {
        this.dbMessage = await getPost(this.message.id);
      } else if (this.messageChannelType === "oddjob") {
        this.dbMessage = await getOddJob(this.message.id);
      }

      // If the message is not found in the database, curate it = insert it
      // but only if it is not a thread, threads are only inserted when they get a payment reaction
      if (!this.dbMessage && !this.parentId) {
        logger.warn("Message not found in the database.");
        //todo remove the waspartial logic here
        this.dbMessage = await MessageCurator.curate(this.message, false);
      }
    }
    this.dbUser = await findOrCreateUserFromDiscordUser(this.discordUser);
    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    this.emojiType = await classifyReaction(this.dbEmoji);
    this.dbMessage = await getPostOrOddjob(
      this.message.id,
      this.messageChannelType
    );

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

      if (this.messageChannelType === "post" && !this.parentId) {
        await this.curatePostReactionAdd();
      } else if (this.messageChannelType === "oddjob") {
        await this.curateOddJobReactionAdd();
      } else if (this.messageChannelType === "post" && this.parentId) {
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
        `because an error occurred, bot will remove the reaction ${
          this.reaction.emoji.name || this.reaction.emoji.id
        } by ${this.discordUser.username}`
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
      await this.curatePowerUserReactionAdd();
    } else {
      await this.curateRegularUserReactionAdd();
    }
  }

  static async curateOddJobReactionAdd() {
    return this.curatePostReactionAdd();
  }

  static async curateThreadReactionAdd() {
    // only consider payment reactions
    if (this.emojiType !== "payment") {
      return;
    }

    // 1. insert the thread as a post into the db
    console.log("this db message before", this.dbMessage);
    if (!this.dbMessage) {
      this.dbMessage = await findOrCreateThreadPost({
        message: this.message,
        content: this.message.content,
        url: this.messageLink || "",
      });

      console.log("this db message now", this.dbMessage);
    }

    // 2. continue handling the reaction as a post reaction
    this.curatePostReactionAdd();
  }

  /**
   * Handles the addition of a reaction by a power user to either a post or an odd job
   */
  static async curatePowerUserReactionAdd() {
    // 1. insert the reaction to the db
    await this.curateRegularUserReactionAdd();

    // 2. handle specific emoji types to update relevant other db schemas
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

    const dbPostOrOddjob =
      this.messageChannelType === "post"
        ? await getPostWithEarnings(this.message.id)
        : await getOddjobWithEarnings(this.message.id);

    if (!dbPostOrOddjob) {
      throw new Error(
        `${this.messageChannelType} for ${this.messageLink} not found.`
      );
    }

    // const entityTotalEarnings = dbPostOrOddjob.earnings.find(
    //   (e) => e.unit === unit
    // )?.totalAmount;

    const earningsCondition =
      this.messageChannelType === "post"
        ? { postId: dbPostOrOddjob.id }
        : { oddJobId: dbPostOrOddjob.id };

    const whereEarningsCondition =
      this.messageChannelType === "post"
        ? { postId_unit: { postId: dbPostOrOddjob.id, unit } }
        : { oddJobId_unit: { oddJobId: dbPostOrOddjob.id, unit } };

    // add or update the post earnings (this is adding redundancy but makes querying easier)
    await prisma.contentEarnings.upsert({
      //todo
      where: whereEarningsCondition,
      update: {
        totalAmount: {
          increment: amount,
        },
      },
      create: {
        ...earningsCondition,
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

    const paymentData = {
      amount,
      unit,
      [this.messageChannelType === "post" ? "postId" : "oddJobId"]:
        dbPostOrOddjob.id,
      fundingSource: paymentRule.fundingSource,
      userId: this.dbUser.id,
      reactionId: this.dbReaction.id,
      status: "unknown", // TODO: implement payment status
      threadParentId: this.parentId,
    };

    console.log("payment data", paymentData);

    // Insert a payment record
    await prisma.payment.create({
      data: paymentData,
    });

    // Update the post to set isPublished to true
    if (
      this.messageChannelType === "post" &&
      !this.parentId &&
      !(dbPostOrOddjob as Post).isPublished
    ) {
      await prisma.post.update({
        where: { id: dbPostOrOddjob.id },
        data: { isPublished: true },
      });
      logger.log(`[post] The post ${this.messageLink} has been published.`);
    }

    await logContentEarnings(
      dbPostOrOddjob,
      this.messageChannelType,
      this.messageLink || ""
    );
  }

  static async handleAddFeatureRule() {
    await featurePost(this.message.id);
    logger.log(`[post][feature] Post is now featured ${this.messageLink}.`);
  }

  private static async curateRegularUserReactionAdd() {
    // just insert the reaction to the db
    this.dbReaction = await upsertEntityReaction(
      this.dbMessage,
      this.messageChannelType,
      this.dbUser!,
      this.dbEmoji
    );
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

    //todo maybe the deletion can be put here?
    if (this.isReactionFromPowerUser) {
      await this.curatePowerUserPostReactionRemove();
    } else {
      await this.curateRegularUserReactionRemove();
    }

    // Additional tasks for special emojis can be handled here
  }

  private static async curateOddJobReactionRemove() {
    return this.curatePostReactionRemove();
  }

  private static async curateThreadReactionRemove() {
    // TODO
  }

  private static async curatePowerUserPostReactionRemove() {
    // 1. delete the reaction from the db
    this.curateRegularUserReactionRemove();

    // 2. handle specific emoji types to update relevant other db schemas
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
        break;
    }
  }

  /**
   * power user oddjob reaction removes are the same as post reaction removes
   * @returns
   */
  private static curatePowerUserOddJobReactionRemove() {
    return this.curatePowerUserPostReactionRemove();
  }

  /**
   * regular user oddjob reaction removes are the same as post reaction removes
   */
  private static curateRegularUserOddJobReactionRemove() {
    return this.curateRegularUserReactionRemove();
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

    const dbPostOrOddjob =
      this.messageChannelType === "post"
        ? await getPostWithEarnings(this.message.id)
        : await getOddjobWithEarnings(this.message.id);

    if (!dbPostOrOddjob) {
      throw new Error(`Post for ${this.messageLink} not found.`);
    }

    // Retrieve the payment rule for the reaction emoji
    const paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);
    if (!paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }
    const amount = paymentRule.paymentAmount;
    const unit = paymentRule.paymentUnit;

    if (!paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    const whereCondition =
      this.messageChannelType === "post"
        ? { postId: dbPostOrOddjob.id }
        : { oddJobId: dbPostOrOddjob.id };

    // Fetch all reactions for the post and filter in code to include only those with a PaymentRule
    const remainingReactions = await prisma.reaction.findMany({
      where: whereCondition,
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
    if (
      this.messageChannelType === "post" &&
      remainingPaymentEmojis.length === 0
    ) {
      await prisma.post.update({
        where: { id: dbPostOrOddjob.id },
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

    const earningsCondition =
      this.messageChannelType === "post"
        ? { postId: dbPostOrOddjob.id }
        : { oddJobId: dbPostOrOddjob.id };

    const whereEarningsCondition =
      this.messageChannelType === "post"
        ? { postId_unit: { postId: dbPostOrOddjob.id, unit } }
        : { oddJobId_unit: { oddJobId: dbPostOrOddjob.id, unit } };

    // Update the post's total earnings for the specific unit
    await prisma.contentEarnings.upsert({
      where: whereEarningsCondition,
      update: {
        totalAmount: updatedTotalEarnings,
      },
      create: {
        ...earningsCondition,
        unit: paymentRule.paymentUnit,
        totalAmount: updatedTotalEarnings,
      },
    });

    await logContentEarnings(
      dbPostOrOddjob,
      this.messageChannelType,
      this.messageLink || ""
    );
  }

  private static async handleRemoveFeatureRule() {
    await unfeaturePost(this.message.id);
    logger.log(`[feature] Feature rule removed from ${this.messageLink}.`);
  }

  private static async curateRegularUserReactionRemove() {
    if (!this.dbMessage) {
      throw new Error("dbMessage is not defined in regularUserReactionRemove");
    } else if (!this.discordUser) {
      throw new Error("dbUser is not defined in regularUserReactionRemove");
    }

    try {
      await deleteEntityReaction(
        this.dbMessage,
        this.messageChannelType,
        this.discordUser.id,
        this.dbEmoji.id
      );
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        return;
      } else {
        console.warn("error in regularUserReactionRemove", error);
      }
    }
  }

  private static async removeReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    // Add logic to handle a reaction removal
    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertPostReaction(
      dbPost,
      this.dbUser!,
      this.dbEmoji
    );

    // Additional tasks for special emojis can be handled here
  }

  private static async reconcileReactions(
    messageReactions: Collection<string, MessageReaction>
  ): Promise<void> {
    // 1. remove all reactions and payments and soon to start fresh
    await resetPostOrOddjobReactions(this.message.id, this.messageChannelType);

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

    if (this.parentId) {
      return false;
    }

    const dbPostOrOddjob = await getPostOrOddjob(
      this.message.id,
      this.messageChannelType
    );

    if (!dbPostOrOddjob) {
      // if the message is a thread it is not necessarily in the db yet
      // as it will only be added on payment. so we can ignore it here
      // if it is already tracked the discrepancy detection will continue below in another case
      if (this.parentId) {
        return false;
      } else {
        logger.warn(
          `[${this.messageChannelType}] detectDiscrepancy: ${this.messageChannelType} with id ${this.reaction.message.id} not found in the database.`
        );
        return true;
      }
    }

    const dbPostOrOddjobReactionCount = await getPostOrOddjobReactionCount(
      this.message.id,
      this.messageChannelType
    );
    if (!dbPostOrOddjobReactionCount) {
      logger.warn(
        `[${this.messageChannelType}] ${this.messageChannelType} with id ${this.reaction.message.id} has no reactions in the database.`
      );
      return true;
    }

    const discordReactionCount = this.reaction.message.reactions.cache.size;

    if (discordReactionCount !== dbPostOrOddjobReactionCount + 1) {
      logger.warn(
        `[${this.messageChannelType}] ${this.messageChannelType} with ID ${this.reaction.message.id} has a different number of reactions in the database.`,
        ` discord: ${discordReactionCount - 1}`,
        ` db: ${dbPostOrOddjobReactionCount}`
      );
      return true;
    }

    return false;
  }

  private static async isReactionAddPermitted(): Promise<boolean> {
    // 0. regular users can only add regular emojis
    if (!this.isReactionFromPowerUser && this.emojiType !== "regular") {
      await logger.logAndSend(
        `Regular users cannot add ${this.emojiType} emojis to messages.`,
        this.discordUser
      );
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

    if (this.messageChannelType === "post" && !this.parentId) {
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

        // 1.4. make sure translation posts have a non anglo category
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

      // 3. when adding non anglo emoji to published posts, make sure the post has a flag
      if (
        post.isPublished &&
        (this.reaction.emoji.name === config.categoryEmojiMap["Non Anglo"] ||
          this.reaction.emoji.name === config.categoryEmojiMap.Translations)
      ) {
        //get post reactions
        const postReactions = await getPostReactions(this.message.id);

        // check if the post has a flag
        const hasFlag = postReactions.some((reaction) =>
          isCountryFlag(reaction.emoji?.id)
        );

        if (!hasFlag) {
          logger.logAndSend(
            `Before you can add the non anglo or translation emoji to the published post ${this.messageLink}, make sure it has a flag.`,
            this.discordUser
          );

          throw new Error("Post is non anglo and has no flag");
        }
      }
    }

    // 4. oddjobs
    if (this.messageChannelType === "oddjob") {
      //4.1 only power users can add emojis to oddjobs
      if (!this.isReactionFromPowerUser) {
        throw new Error("Regular users cannot add emojis to oddjobs");
      }

      const oddJob = this.dbMessage as OddJob;
      if (!oddJob) {
        logger.warn("Odd job not found in the database.");
        throw new Error("Odd job not found");
      }

      // 4.2 cannot add category emojis or featured emojis to odd jobs
      if (this.emojiType === "category" || this.emojiType === "feature") {
        throw new Error(`Cannot add ${this.emojiType} emojis to odd jobs.`);
      }
    }

    // 5. threads
    if (this.messageChannelType === "post" && this.parentId) {
      //5.1.cannot add category emojis or featured emojis to threads
      if (this.emojiType === "category" || this.emojiType === "feature") {
        throw new Error(`Cannot add ${this.emojiType} emojis to threads.`);
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
    // 1. if oddjob then only manager can pay
    if (this.messageChannelType === "oddjob") {
      const oddJob = this.dbMessage as OddJob;
      if (!oddJob) {
        logger.warn("Odd job not found in the database.");
        throw new Error("Odd job not found");
      }

      if (oddJob.managerId !== this.discordUser.id) {
        logger.logAndSend(
          `You do not have permission to add payment reactions in ${this.messageLink}, only the assigned manager can do that.`,
          this.discordUser
        );
        return false;
      }
    }

    // 2. payments are only valid if they match the first payment's unit
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

    // Validate the reaction's payment rule against the first payment's rule
    return (
      paymentRule.paymentUnit === firstPayment.unit &&
      paymentRule.fundingSource === firstPayment.fundingSource
    );
  }
}

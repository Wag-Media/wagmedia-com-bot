import {
  classifyMessage,
  classifyReaction,
  ensureFullMessage,
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

import * as config from "../config.js";
import {
  findEmojiCategoryRule,
  findEmojiPaymentRule,
  findOrCreateEmoji,
} from "@/data/emoji.js";
import {
  addCategory,
  fetchPost,
  findOrCreatePost,
  getPost,
  getPostReactionCount,
  getPostWithEarnings,
} from "@/data/post.js";
import { Type } from "typescript";
import { discordClient, logger } from "@/client.js";
import { PostWithCategories, emojiType } from "../types";
import { getPostReactions, upsertReaction } from "@/data/reaction.js";
import { findOrCreateUserFromDiscordUser } from "@/data/user.js";
import { MessageCurator } from "./message-curator.js";
import { prisma } from "@/utils/prisma.js";
import { isCountryFlag } from "@/utils/is-country-flag.js";
import { getOddJob } from "@/data/oddjob.js";
import { logPostEarnings } from "@/handlers/log-utils.js";

export type TypeCuratorPartial = {
  message: boolean;
  user: boolean;
  reaction: boolean;
};

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class ReactionCurator {
  private static handlingDiscrepancy: boolean = false;
  private static reaction: MessageReaction;
  private static dbReaction: Reaction | undefined;
  private static dbEmoji: Emoji;
  private static emojiType: emojiType;
  private static discordUser: DiscordUser;
  private static dbUser: User | undefined;
  private static wasPartial: TypeCuratorPartial;
  private static message: Message;
  private static messageLink: string | undefined;
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static dbMessage: PostWithCategories | OddJob | null | undefined;
  private static parentId: string | undefined;
  private static isReactionFromPowerUser: boolean = false;
  private static guild: Guild | undefined;

  private static async initialize(
    reaction: MessageReaction,
    user: DiscordUser,
    wasPartial: TypeCuratorPartial
  ) {
    // Assign the reaction and user to class-level variables
    this.reaction = reaction;
    this.discordUser = user;
    this.wasPartial = wasPartial;

    // Ensure the message associated with the reaction is fully fetched
    // This might be necessary if the message could be partially loaded due to Discord's API limitations
    if (wasPartial.message) {
      const messagePartial = await ensureFullMessage(reaction.message);
      this.message = messagePartial.message;
    } else {
      this.message = reaction.message as Message;
    }

    if (shouldIgnoreMessage(this.reaction.message)) {
      logger.warn("Message is to be ignored. Skipping reaction curation.");
      throw new Error("Message is to be ignored");
    }

    // no need to initialize guild, message link, parent id as they are all message related which is already initialized
    if (!this.handlingDiscrepancy) {
      // Set the guild from the reaction message, which might involve fetching it if not readily available
      this.guild =
        this.message.guild ||
        (this.message.guildId &&
          (await discordClient.guilds.fetch(this.message.guildId))) ||
        undefined;

      if (!this.guild) {
        logger.warn("Guild not found for message.");
        return;
      }

      // Generate the link to the message for logging or other purposes
      this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

      // Classify the message to determine its type (post, oddjob, thread) and potentially its parent ID
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
        this.dbMessage = await MessageCurator.curate(
          this.message,
          wasPartial.message
        );
      }

      console.log("initialize", this.messageChannelType, this.dbMessage);
    }

    // Find or create a database entry for the user reacting
    this.dbUser = await findOrCreateUserFromDiscordUser(user);

    // Find or create a database entry for the emoji used in the reaction
    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    this.emojiType = await classifyReaction(this.dbEmoji);

    if (!this.guild) {
      throw new Error("Guild is not defined");
    }

    // Check if the user reacting has a "power user" role, according to your app's logic
    this.isReactionFromPowerUser = userHasRole(
      this.guild,
      user,
      config.ROLES_WITH_POWER
    );
  }

  static async curate(
    reaction: MessageReaction,
    user: DiscordUser,
    wasPartial: TypeCuratorPartial
  ) {
    logger.log(
      `curating reaction ${reaction.emoji.name} for ${reaction.message.id} ${
        this.handlingDiscrepancy ? "while handling discrepancy" : ""
      }`
    );

    try {
      await this.initialize(reaction, user, wasPartial);
    } catch (error) {
      logger.error("Error in reaction curation initialization:", error);
      return;
    }

    // Skip certain initializations if handling a discrepancy
    if (!this.handlingDiscrepancy) {
      // Perform checks and set handlingDiscrepancy if needed
      const discrepancyDetected = await this.detectDiscrepancy();
      if (discrepancyDetected) {
        this.handlingDiscrepancy = true;
        await this.handleDiscrepancies(this.reaction.message.reactions.cache);
        this.handlingDiscrepancy = false;
        return;
      }
    }

    // this is the main logic of the reaction curation that will only
    // be executed if not handling a discrepancy
    try {
      await this.isReactionPermitted();

      if (this.messageChannelType === "post") {
        await this.curatePostReaction();
      } else if (this.messageChannelType === "oddjob") {
        await this.curateOddJobReaction();
      } else if (this.parentId) {
        await this.curateThreadReaction();
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
      await this.reaction.users.remove(this.discordUser.id);
    }
  }

  static async curateThreadReaction() {
    if (!this.isReactionFromPowerUser) {
      return;
    }
  }

  static async curatePostReaction() {
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
      await this.curatePowerUserPostReaction();
    } else {
      await this.curateRegularUserPostReaction();
    }
  }

  static async curateOddJobReaction() {
    // TODO
  }

  static async curatePowerUserPostReaction() {
    switch (this.emojiType) {
      case "category":
        await this.handleCategoryRule();
        break;
      case "payment":
        await this.handlePaymentRule();
        break;
      case "feature":
        await this.handleFeatureRule();
        break;
      default:
        //nothing special to do for regular emojis as already handled in curatePostReaction
        break;
    }

    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertReaction(dbPost, this.dbUser!, this.dbEmoji);
  }

  static async curateRegularUserPostReaction() {
    let dbPost = this.dbMessage as Post;
    this.dbReaction = await upsertReaction(dbPost, this.dbUser!, this.dbEmoji);
  }

  static async handleDiscrepancies(
    messageReactions: Collection<string, MessageReaction>
  ): Promise<void> {
    console.log("handleDiscrepancies");
    for (const [, messageReaction] of messageReactions) {
      console.log("iterate", messageReaction.emoji.name);
      await this.curate(messageReaction, this.discordUser, {
        message: false,
        user: false,
        reaction: false,
      });
    }
  }

  static async isReactionPermitted(): Promise<boolean> {
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
              `Before you can publish the post ${this.messageLink}, make sure it has a flag.`,
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
    }

    return true;
  }

  static async detectDiscrepancy(): Promise<boolean> {
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

  static async handleCategoryRule() {
    this.betterSafeThanSorry();

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

  static async handlePaymentRule() {
    console.log("payment rule should be handled here");

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
    }

    logPostEarnings(post, this.messageLink || "");
  }

  static async handleFeatureRule() {}

  static async isPaymentReactionValid(
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

    // Validate the reaction's payment rule against the first payment's rule
    return (
      paymentRule.paymentUnit === firstPayment.unit &&
      paymentRule.fundingSource === firstPayment.fundingSource
    );
  }

  static betterSafeThanSorry() {
    if (!this.isReactionFromPowerUser) {
      throw new Error("User is not a power user");
    }
  }
}

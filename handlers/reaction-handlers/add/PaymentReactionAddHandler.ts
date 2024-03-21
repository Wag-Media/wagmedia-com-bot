import {
  MessageReaction,
  User as DiscordUser,
  ThreadChannel,
} from "discord.js";
import { PaymentRule, Post } from "@prisma/client";
import { findEmojiPaymentRule } from "@/data/emoji";
import {
  ContentType,
  OddJobWithOptions,
  PostWithCategories,
  PostWithOptions,
} from "@/types";
import { prisma } from "@/utils/prisma";
import { isPaymentUnitValid } from "../../../curators/utils";
import { getPostReactions, upsertEntityReaction } from "@/data/reaction";
import { logContentEarnings } from "@/handlers/log-utils";
import { BaseReactionHandler } from "../_BaseReactionHandler";
import { findOrCreatePost, findOrCreateThreadPost, getPost } from "@/data/post";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { discordClient, logger } from "@/client";
import { isCountryFlag } from "@/utils/is-country-flag";
import { getOddJob } from "@/data/oddjob";
import { ThreadPaymentReactionRemoveHandler } from "../remove/PaymentReactionRemoveHandler";
import { slugify } from "@/handlers/util";
import { findOrCreateUser } from "@/data/user";

abstract class BasePaymentReactionAddHandler extends BaseReactionAddHandler {
  protected paymentRule: PaymentRule | null;
  protected parentId: string | null = null;

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    await super.initialize(reaction, user);

    this.paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);
    if (!this.paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    await this.isPaymentReactionValid(reaction, user);
  }

  protected async postProcess(): Promise<void> {
    await logContentEarnings(
      this.dbContent!,
      this.contentType,
      this.messageLink
    );
  }

  protected async isPaymentReactionValid(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<boolean> {
    //todo add more checks here

    const unitValid = await isPaymentUnitValid(
      reaction.message.id,
      this.contentType,
      this.paymentRule
    );

    if (!unitValid) {
      logger.logAndSend(
        `Payment unit for ${this.messageLink} is invalid as it does not equal the unit of the first payment.`,
        user
      );
      throw new Error("Payment unit is invalid");
    }

    return true;
  }
}

export class PostPaymentReactionAddHandler extends BasePaymentReactionAddHandler {
  contentType: ContentType = "post";

  protected getDbContent(
    reaction: MessageReaction
  ): Promise<PostWithCategories | null> {
    return getPost(reaction.message.id);
  }

  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ) {
    // Specific logic for processing payment for a post
    console.log(
      "Handling payment reaction for a post with parentId",
      this.parentId
    );

    const { paymentAmount, paymentUnit, fundingSource } = this.paymentRule!;

    await prisma.contentEarnings.upsert({
      where: {
        postId_unit: {
          postId: this.dbContent!.id,
          unit: paymentUnit,
        },
      },
      update: {
        totalAmount: {
          increment: paymentAmount,
        },
      },
      create: {
        postId: this.dbContent!.id,
        unit: paymentUnit,
        totalAmount: paymentAmount,
      },
    });

    await prisma.payment.create({
      data: {
        amount: paymentAmount,
        unit: paymentUnit,
        postId: this.dbContent!.id,
        userId: this.dbUser!.id,
        reactionId: this.dbReaction!.id,
        status: "unknown",
        fundingSource,
        threadParentId: this.parentId,
      },
    });

    if (this.contentType === "post" && !(this.dbContent as Post).isPublished) {
      await prisma.post.update({
        where: { id: this.dbContent!.id },
        data: { isPublished: true },
      });
    }
  }

  protected async isReactionPermitted(reaction, user): Promise<boolean> {
    const post = this.dbContent as PostWithCategories;

    // 1.1. make sure the post has a title and description
    if (!post.title || !post.content) {
      logger.logAndSend(
        `Before you can publish the post ${this.messageLink}, make sure it has a title and description.`,
        user
      );
      throw new Error("Post has no title or description");
    }

    // 1.2. make sure the post has a category
    if (post.categories.length === 0) {
      logger.logAndSend(
        `Before you can publish the post ${this.messageLink}, make sure it has a category.`,
        user
      );
      throw new Error("Post has no category");
    }

    // 1.3. make sure non anglo posts have a flag
    const isNonAnglo = post.categories.some((category) =>
      category.name.includes("Non Anglo")
    );

    if (isNonAnglo) {
      //get post reactions
      const postReactions = await getPostReactions(reaction.message.id);

      // check if the post has a flag
      const hasFlag = postReactions.some((reaction) =>
        isCountryFlag(reaction.emoji?.id)
      );

      if (!hasFlag) {
        logger.logAndSend(
          `Before you can publish the post ${this.messageLink} with non anglo category, make sure it has a flag.`,
          user
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
        user
      );

      throw new Error("Post is translation and has no non anglo category");
    }

    return true;
  }
}

export class OddJobPaymentReactionAddHandler extends BasePaymentReactionAddHandler {
  contentType: ContentType = "oddjob";

  protected getDbContent(
    reaction: MessageReaction
  ): Promise<OddJobWithOptions | null> {
    return getOddJob(reaction.message.id);
  }

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<boolean> {
    const oddJob = await this.getDbContent(reaction);
    const payerIsManager = oddJob?.managerId === user.id;

    if (!payerIsManager) {
      logger.logAndSend(
        `Only the manager of the odd job ${this.messageLink} can pay for it.`,
        user
      );
      throw new Error("Payer is not the manager of the odd job");
    }

    return true;
  }

  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ) {
    console.log("Handling payment reaction for oddjob");

    const { paymentAmount, paymentUnit, fundingSource } = this.paymentRule!;

    const dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji
    );

    await prisma.contentEarnings.upsert({
      where: {
        oddJobId_unit: {
          oddJobId: this.dbContent!.id,
          unit: paymentUnit,
        },
      },
      update: {
        totalAmount: {
          increment: paymentAmount,
        },
      },
      create: {
        oddJobId: this.dbContent!.id,
        unit: paymentUnit,
        totalAmount: paymentAmount,
      },
    });

    await prisma.payment.create({
      data: {
        amount: paymentAmount,
        unit: paymentUnit,
        oddJobId: this.dbContent!.id,
        userId: this.dbUser!.id,
        reactionId: dbReaction.id,
        status: "unknown",
        fundingSource,
        threadParentId: (this.dbContent as Post).parentPostId,
      },
    });
  }
}

export class ThreadPaymentReactionAddHandler extends PostPaymentReactionAddHandler {
  contentType: ContentType = "thread";

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("Initializing payment reaction for a thread");
    await super.initialize(reaction, user);

    // If the message is a thread, set the parentId
    this.parentId = reaction.message.channelId;
  }

  protected isReactionPermitted(reaction: any, user: any): Promise<boolean> {
    // Payments to threads (by superusers) are always permitted
    return Promise.resolve(true);
  }

  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ) {
    console.log("Handling payment reaction for a thread");

    // 1. if the thread is not in the database, create it on payment
    if (!this.dbContent) {
      this.dbContent = await findOrCreateThreadPost({
        message: reaction.message,
        content: reaction.message.content || "",
        url: this.messageLink || "",
      });
    }

    // 2. add the dbReaction to the db (it was not as post was not defined)
    this.dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji
    );

    // 3. if the parent post is not in the db, create it
    const parentPost = await getPost(this.parentId!);
    if (!parentPost) {
      const parentChannel = (reaction.message.channel as ThreadChannel).parent;

      const parentMessage = await parentChannel?.messages.fetch(this.parentId!);
      if (!parentMessage) throw new Error("Message not found.");

      const parentMessageLink = `https://discord.com/channels/${parentMessage.guild?.id}/${parentMessage.channel.id}/${parentMessage.id}`;

      const dbUser = await findOrCreateUser(parentMessage);

      const parentPost = await prisma.post.create({
        data: {
          id: parentMessage.id,
          title: "",
          content: "",
          discordLink: parentMessageLink,
          userId: dbUser.id, // Assuming you have the user's ID
          isPublished: false,
          isDeleted: false,
          isFeatured: false,
        },
      });

      console.info("parentPost created");
    }

    // 4. process the payment as in posts
    await super.processReaction(reaction, user);
  }
}

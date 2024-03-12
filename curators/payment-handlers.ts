import { MessageReaction, User as DiscordUser, Guild } from "discord.js";
import { IReactionHandler } from "./interface-reaction-handler";
import { Emoji, OddJob, PaymentRule, Post, User } from "@prisma/client";
import { findEmojiPaymentRule, findOrCreateEmoji } from "@/data/emoji";
import {
  ContentType,
  OddjobWithEarnings,
  PostWithCategories,
  PostWithEarnings,
} from "@/types";
import {
  getPostOrOddjob,
  getPostOrOddjobWithEarnings,
  getPostWithEarnings,
} from "@/data/post";
import { getGuildFromMessage } from "@/handlers/util";
import { prisma } from "@/utils/prisma";
import { findFirstPayment } from "@/data/payment";
import { isPaymentUnitValid } from "./utils";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { upsertEntityReaction } from "@/data/reaction";
import { logContentEarnings } from "@/handlers/log-utils";

abstract class PaymentReactionHandler implements IReactionHandler {
  abstract contentType: ContentType;
  protected messageLink: string;
  protected guild: Guild | null;
  protected dbEmoji: Emoji;
  protected dbUser: User | undefined;
  protected paymentRule: PaymentRule | null;
  protected dbMessage: PostWithEarnings | OddjobWithEarnings | null | undefined;

  protected async isPaymentReactionValid(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<boolean> {
    return await isPaymentUnitValid(
      reaction.message.id,
      this.contentType,
      this.paymentRule
    );
  }

  async handle(reaction: MessageReaction, user: DiscordUser): Promise<void> {
    // Shared pre-processing steps
    await this.initialize(reaction, user);
    // Delegating to the subclass-specific logic
    await this.processPayment(reaction, user);
    // Shared post-processing steps
    await this.postProcess(reaction, user);
  }

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    // Shared logic before processing payment, e.g., logging, validation
    this.guild = await getGuildFromMessage(reaction.message);
    this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    this.dbUser = await findOrCreateUserFromDiscordUser(user);
    this.paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);
    this.dbMessage = await getPostOrOddjobWithEarnings(
      reaction.message.id,
      this.contentType
    );

    if (!this.paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    if (!(await this.isPaymentReactionValid(reaction, user))) {
      throw new Error(`Payment reaction for ${this.messageLink} is not valid.`);
    }
  }

  protected abstract processPayment(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void>;

  protected async postProcess(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    // Shared logic after processing payment, e.g., notifications
  }
}

export class PostPaymentReactionHandler extends PaymentReactionHandler {
  contentType: ContentType = "post";
  protected async processPayment(reaction: MessageReaction, user: DiscordUser) {
    // Specific logic for processing payment for a post
    console.log("Handling payment reaction for a post");
    if (!this.paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    if (!this.dbUser) {
      throw new Error(`User for ${this.messageLink} not found.`);
    }

    if (!this.dbMessage) {
      throw new Error(`Post for ${this.messageLink} not found.`);
    }

    const { paymentAmount, paymentUnit } = this.paymentRule;

    const dbReaction = await upsertEntityReaction(
      this.dbMessage,
      this.contentType,
      this.dbUser,
      this.dbEmoji
    );

    await prisma.contentEarnings.upsert({
      where: {
        postId_unit: {
          postId: this.dbMessage.id,
          unit: paymentUnit,
        },
      },
      update: {
        totalAmount: {
          increment: paymentAmount,
        },
      },
      create: {
        postId: this.dbMessage.id,
        unit: paymentUnit,
        totalAmount: paymentAmount,
      },
    });

    await prisma.payment.create({
      data: {
        amount: paymentAmount,
        unit: paymentUnit,
        postId: this.dbMessage.id,
        userId: this.dbUser.id,
        reactionId: dbReaction.id,
        status: "unknown",
      },
    });

    if (!(this.dbMessage as Post).isPublished) {
      await prisma.post.update({
        where: { id: this.dbMessage.id },
        data: { isPublished: true },
      });
    }

    await logContentEarnings(this.dbMessage, "post", this.messageLink);
  }
}

export class OddJobPaymentReactionHandler extends PaymentReactionHandler {
  contentType: ContentType = "oddjob";
  protected processPayment(reaction: MessageReaction, user: DiscordUser) {
    // Specific logic for processing payment for an odd job
    console.log("Handling payment reaction for an odd job");
    return Promise.resolve();
  }
}

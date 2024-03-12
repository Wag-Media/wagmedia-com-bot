import { MessageReaction, User as DiscordUser } from "discord.js";
import { PaymentRule, Post } from "@prisma/client";
import { findEmojiPaymentRule } from "@/data/emoji";
import { ContentType } from "@/types";
import { prisma } from "@/utils/prisma";
import { isPaymentUnitValid } from "./utils";
import { upsertEntityReaction } from "@/data/reaction";
import { logContentEarnings } from "@/handlers/log-utils";
import { BaseReactionHandler } from "./base-handlers";
import { findOrCreateThreadPost } from "@/data/post";

abstract class BasePaymentReactionHandler extends BaseReactionHandler {
  protected paymentRule: PaymentRule | null;
  protected parentId: string | null = null;

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("BasePaymentReactionHandler: Initializing payment reaction");
    await super.initialize(reaction, user);

    this.paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);
    if (!this.paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }

    if (!(await this.isPaymentReactionValid(reaction, user))) {
      throw new Error(`Payment reaction for ${this.messageLink} is not valid.`);
    }
  }

  protected async postProcess(): Promise<void> {
    await logContentEarnings(this.dbContent!, "post", this.messageLink);
  }

  protected async isPaymentReactionValid(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<boolean> {
    //todo add more checks here
    return await isPaymentUnitValid(
      reaction.message.id,
      this.contentType,
      this.paymentRule
    );
  }
}

export class PostPaymentReactionHandler extends BasePaymentReactionHandler {
  contentType: ContentType = "post";

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

    const dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji
    );

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
        reactionId: dbReaction.id,
        status: "unknown",
        fundingSource,
        threadParentId: this.parentId,
      },
    });

    if (!(this.dbContent as Post).isPublished) {
      await prisma.post.update({
        where: { id: this.dbContent!.id },
        data: { isPublished: true },
      });
    }
  }
}

export class OddJobPaymentReactionHandler extends BasePaymentReactionHandler {
  contentType: ContentType = "oddjob";
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

export class ThreadPaymentReactionHandler extends PostPaymentReactionHandler {
  contentType: ContentType = "thread";

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("Initializing payment reaction for a thread");
    await super.initialize(reaction, user);

    // If the message is a thread, set the parentId
    this.parentId = reaction.message.channelId;
    console.log("ParentId set to", this.parentId);
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

    // 2. process the payment as in posts
    await super.processReaction(reaction, user);
  }

  protected async postProcess(): Promise<void> {
    return Promise.resolve();
  }
}

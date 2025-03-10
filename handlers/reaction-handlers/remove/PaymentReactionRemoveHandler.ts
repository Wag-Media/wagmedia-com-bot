import { PaymentRule, Post } from "@prisma/client";
import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { MessageReaction, User as DiscordUser } from "discord.js";
import { findEmojiPaymentRule } from "@/data/emoji";
import { logContentEarnings } from "@/handlers/log-utils";
import { isPaymentUnitValid } from "@/curators/utils";
import { ContentType } from "@/types";
import { prisma } from "@/utils/prisma";
import { logger } from "@/client";
import * as config from "@/config";
import {
  OddJobPaymentReactionAddHandler,
  ThreadPaymentReactionAddHandler,
} from "../add/PaymentReactionAddHandler";

abstract class BasePaymentReactionRemoveHandler extends BaseReactionRemoveHandler {
  protected paymentRule: PaymentRule | null;
  protected parentId: string | null = null;

  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    await super.initialize(reaction, user);

    this.paymentRule = await findEmojiPaymentRule(this.dbEmoji.id);
    if (!this.paymentRule) {
      throw new Error(`Payment rule for ${this.messageLink} not found.`);
    }
  }

  protected async postProcess(): Promise<void> {
    await logContentEarnings(
      this.dbContent!,
      this.contentType,
      this.messageLink,
    );
  }

  protected isReactionPermitted(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<boolean> {
    //todo payments can only be removed if post is not too old
    return Promise.resolve(true);
  }
}

export class PostPaymentReactionRemoveHandler extends BasePaymentReactionRemoveHandler {
  contentType: ContentType = "post";
  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    const amount = this.paymentRule?.paymentAmount;
    const unit = this.paymentRule?.paymentUnit;

    if (!amount || !unit) {
      throw new Error(`Payment rule for ${this.messageLink} is invalid.`);
    }

    const remainingPostReactions = await prisma.reaction.findMany({
      where: {
        postId: this.dbContent!.id,
      },
      include: {
        emoji: {
          include: {
            PaymentRule: true,
          },
        },
      },
    });

    // Check if there are no remaining payment emojis
    const remainingPaymentEmojis = remainingPostReactions.filter(
      (r) => r.emoji.PaymentRule && r.emoji.PaymentRule.length > 0,
    );

    // If no payment emojis are left
    if (
      this.contentType === "post" &&
      remainingPaymentEmojis.length === 0 &&
      (this.dbContent as Post).isPublished
    ) {
      // and the post is not published via UPE
      if (
        !remainingPostReactions.some(
          (r) => r.emoji.name === config.UNIVERSAL_PUBLISH_EMOJI,
        )
      ) {
        // unpublish the post
        await prisma.post.update({
          where: { id: this.dbContent!.id },
          data: { isPublished: false, firstPaymentAt: null },
        });
        logger.log(
          `[post] Post ${this.messageLink} has been unpublished due to no remaining payment emojis.`,
        );
      }
    }

    // Aggregate the total payment amount for the specific unit
    const updatedTotalEarnings = remainingPaymentEmojis.reduce((total, r) => {
      const rule = r.emoji.PaymentRule.find((pr) => pr.paymentUnit === unit);
      return total + (rule?.paymentAmount || 0);
    }, 0);

    // Update the post's total earnings for the specific unit
    await prisma.contentEarnings.upsert({
      where: { postId_unit: { postId: this.dbContent!.id, unit } },
      update: {
        totalAmount: updatedTotalEarnings,
      },
      create: {
        postId: this.dbContent!.id,
        unit,
        totalAmount: updatedTotalEarnings,
      },
    });
  }
}

export class OddJobPaymentReactionRemoveHandler extends BasePaymentReactionRemoveHandler {
  contentType: ContentType = "oddjob";
  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    const amount = this.paymentRule?.paymentAmount;
    const unit = this.paymentRule?.paymentUnit;

    if (!amount || !unit) {
      throw new Error(`Payment rule for ${this.messageLink} is invalid.`);
    }

    const remainingOddJobReactions = await prisma.reaction.findMany({
      where: {
        oddJobId: this.dbContent!.id,
      },
      include: {
        emoji: {
          include: {
            PaymentRule: true,
          },
        },
      },
    });

    // Check if there are no remaining payment emojis
    const remainingPaymentEmojis = remainingOddJobReactions.filter(
      (r) => r.emoji.PaymentRule && r.emoji.PaymentRule.length > 0,
    );

    // if no payment emojis are left, remove firstPaymentAt
    if (remainingPaymentEmojis.length === 0) {
      await prisma.oddJob.update({
        where: { id: this.dbContent!.id },
        data: { firstPaymentAt: null },
      });
    }

    // Aggregate the total payment amount for the specific unit
    const updatedTotalEarnings = remainingPaymentEmojis.reduce((total, r) => {
      const rule = r.emoji.PaymentRule.find((pr) => pr.paymentUnit === unit);
      return total + (rule?.paymentAmount || 0);
    }, 0);

    // Update the post's total earnings for the specific unit
    await prisma.contentEarnings.upsert({
      where: { oddJobId_unit: { oddJobId: this.dbContent!.id, unit } },
      update: {
        totalAmount: updatedTotalEarnings,
      },
      create: {
        oddJobId: this.dbContent!.id,
        unit,
        totalAmount: updatedTotalEarnings,
      },
    });
  }
}

export class ThreadPaymentReactionRemoveHandler extends PostPaymentReactionRemoveHandler {
  contentType: ContentType = "thread";
}

export class EventPaymentReactionRemoveHandler extends BasePaymentReactionRemoveHandler {
  contentType: ContentType = "event";

  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    const amount = this.paymentRule?.paymentAmount;
    const unit = this.paymentRule?.paymentUnit;

    if (!amount || !unit) {
      throw new Error(`Payment rule for ${this.messageLink} is invalid.`);
    }

    const remainingEventReactions = await prisma.reaction.findMany({
      where: {
        eventId: this.dbContent!.id,
      },
      include: {
        emoji: {
          include: {
            PaymentRule: true,
          },
        },
      },
    });

    // Check if there are no remaining payment emojis
    const remainingPaymentEmojis = remainingEventReactions.filter(
      (r) => r.emoji.PaymentRule && r.emoji.PaymentRule.length > 0,
    );

    // If no payment emojis are left
    if (this.contentType === "event" && remainingPaymentEmojis.length === 0) {
      // and the post is not published via UPE
      if (
        !remainingEventReactions.some(
          (r) => r.emoji.name === config.UNIVERSAL_PUBLISH_EMOJI,
        )
      ) {
        // unpublish the event
        await prisma.polkadotEvent.update({
          where: { id: this.dbContent!.id },
          data: { isPublished: false, firstPaymentAt: null },
        });
        logger.log(
          `[event] Event ${this.messageLink} has been unpublished due to no remaining payment emojis.`,
        );
      }
    }

    // Aggregate the total payment amount for the specific unit
    const updatedTotalEarnings = remainingPaymentEmojis.reduce((total, r) => {
      const rule = r.emoji.PaymentRule.find((pr) => pr.paymentUnit === unit);
      return total + (rule?.paymentAmount || 0);
    }, 0);

    // Update the post's total earnings for the specific unit
    await prisma.contentEarnings.upsert({
      where: { eventId_unit: { eventId: this.dbContent!.id, unit } },
      update: {
        totalAmount: updatedTotalEarnings,
      },
      create: {
        eventId: this.dbContent!.id,
        unit,
        totalAmount: updatedTotalEarnings,
      },
    });
  }
}

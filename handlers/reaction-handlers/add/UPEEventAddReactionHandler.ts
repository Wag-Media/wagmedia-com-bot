import { featurePost, publishPost } from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType, EventWithOptions } from "@/types";
import { Payment } from "@prisma/client";
import {
  EventPaymentReactionAddHandler,
  PostPaymentReactionAddHandler,
} from "./PaymentReactionAddHandler";
import { MessageReaction, User } from "discord.js";
import { upsertEntityReaction } from "@/data/reaction";
import { prisma } from "@/utils/prisma";
import { publishEvent } from "@/data/event";

/**
 * superusers🦹 can add universal payment emojis (UPE) to posts
 * adding UPE emojis publishes a post
 * UPE can only be added if there are no other payment emojis
 * after UPE is added to a post, no other payment emojis can be added
 * reacting with the universal publish emoji will publish a (valid) post
  even if it has no payments
 */
export class UPEEventAddReactionHandler extends EventPaymentReactionAddHandler {
  contentType: ContentType;

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

  protected async getDbContent(
    reaction: MessageReaction,
  ): Promise<EventWithOptions | null> {
    const event = await prisma.polkadotEvent.findUnique({
      where: {
        id: reaction.message.id,
      },
      include: {
        payments: true,
      },
    });

    return event;
  }

  protected async initialize(
    reaction: MessageReaction,
    user: User,
  ): Promise<void> {
    await this.baseInitialize(reaction, user);
  }

  protected async processReaction(reaction, user): Promise<void> {
    console.log("UPEAddReactionHandler.processReaction", reaction, user);
    this.dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji,
    );
    logger.log(
      `[${this.contentType}] Reaction ${reaction.emoji} added to ${this.messageLink} by ${user.username}#${user.discriminator}.`,
    );
    await publishEvent(reaction.message.id);
    logger.log(
      `[${this.contentType}] ${this.contentType} ${this.messageLink} is now published without any payments.`,
    );
  }

  protected async isReactionPermitted(_, user): Promise<boolean> {
    if (!this.dbContent) {
      throw new Error("Event not found");
    }

    const event = this.dbContent as EventWithOptions;
    if (event.payments?.length && event.payments.length > 0) {
      logger.logAndSend(
        `You can't add the universal payment emoji to a event that already has payments.`,
        user,
      );
      throw new Error("Event already has payments");
    }

    await super.isReactionPermitted(_, user);
    return true;
  }

  protected postProcess(): Promise<void> {
    return Promise.resolve();
  }
}

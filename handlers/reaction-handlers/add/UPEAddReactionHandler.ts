import { featurePost, publishPost } from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import {
  ContentType,
  PostWithCategories,
  PostWithEarnings,
  PostWithPayments,
  PostWithPaymentsAndCategories,
} from "@/types";
import { Payment } from "@prisma/client";
import { PostPaymentReactionAddHandler } from "./PaymentReactionAddHandler";
import { MessageReaction, User } from "discord.js";
import { upsertEntityReaction } from "@/data/reaction";
import { prisma } from "@/utils/prisma";

/**
 * superusers🦹 can add universal payment emojis (UPE) to posts
 * adding UPE emojis publishes a post
 * UPE can only be added if there are no other payment emojis
 * after UPE is added to a post, no other payment emojis can be added
 * reacting with the universal publish emoji will publish a (valid) post
  even if it has no payments
 */
export class UPEAddReactionHandler extends PostPaymentReactionAddHandler {
  contentType: ContentType = "post";

  protected async getDbContent(
    reaction: MessageReaction,
  ): Promise<PostWithPaymentsAndCategories | null> {
    const post = await prisma.post.findUnique({
      where: {
        id: reaction.message.id,
      },
      include: {
        payments: true,
        categories: true,
      },
    });

    return post;
  }

  protected async initialize(
    reaction: MessageReaction,
    user: User,
  ): Promise<void> {
    await this.baseInitialize(reaction, user);
  }

  protected async processReaction(reaction, user): Promise<void> {
    this.dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji,
    );
    logger.log(
      `[${this.contentType}] Reaction ${reaction.emoji} added to ${this.messageLink} by ${user.username}#${user.discriminator}.`,
    );
    await publishPost(reaction.message.id);
    logger.log(
      `[post] Post ${this.messageLink} is now published without any payments.`,
    );
  }

  protected async isReactionPermitted(_, user): Promise<boolean> {
    console.log("upe reaction permitted", this.dbContent);

    // can only add UPE if post was not paid before
    if (
      (this.dbContent as PostWithPaymentsAndCategories).payments?.length > 0
    ) {
      logger.logAndSend(
        `You can't add the universal payment emoji to a post that already has payments.`,
        user,
      );
      throw new Error("Post already has payments");
    }

    await super.isReactionPermitted(_, user);

    return true;
  }

  protected postProcess(): Promise<void> {
    return Promise.resolve();
  }
}

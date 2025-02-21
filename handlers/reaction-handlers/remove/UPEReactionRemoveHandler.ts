import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { ContentType, PostWithPaymentsAndCategories } from "@/types";
import { unpublishPost } from "@/data/post";
import { logger } from "@/client";
import { MessageReaction } from "discord.js";
import { prisma } from "@/utils/prisma";
import { PolkadotEvent } from "@prisma/client";
import { unpublishEvent } from "@/data/event";
/**
 * This class is responsible for handling regular reaction removes
 * it is just no oping as the BaseReactionRemoveHandler already takes care of removing
 * the reaction from the database and discord
 */
export class UPERemoveReactionHandler extends BaseReactionRemoveHandler {
  contentType: ContentType;

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

  protected async getDbContent(
    reaction: MessageReaction,
  ): Promise<PostWithPaymentsAndCategories | PolkadotEvent | null> {
    if (this.contentType === "post") {
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
    } else if (this.contentType === "event") {
      const event = await prisma.polkadotEvent.findUnique({
        where: { id: reaction.message.id },
      });
      return event;
    }

    return null;
  }

  protected async isReactionPermitted(_, user): Promise<boolean> {
    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    if (
      (this.dbContent as PostWithPaymentsAndCategories).payments?.length > 0
    ) {
      return;
    }

    if (this.contentType === "post") {
      await unpublishPost(reaction.message.id);
    } else if (this.contentType === "event") {
      await unpublishEvent(reaction.message.id);
    }

    logger.log(
      `[${this.contentType}] ${this.contentType} ${this.messageLink} is now unpublished.`,
    );
  }
}

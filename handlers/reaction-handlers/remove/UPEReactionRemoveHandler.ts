import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { ContentType, PostWithPaymentsAndCategories } from "@/types";
import { unpublishPost } from "@/data/post";
import { logger } from "@/client";
import { MessageReaction } from "discord.js";
import { prisma } from "@/utils/prisma";

/**
 * This class is responsible for handling regular reaction removes
 * it is just no oping as the BaseReactionRemoveHandler already takes care of removing
 * the reaction from the database and discord
 */
export class UPERemoveReactionHandler extends BaseReactionRemoveHandler {
  contentType: ContentType = "post";

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

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

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    // can only add UPE if post was not paid before
    if (
      (this.dbContent as PostWithPaymentsAndCategories).payments?.length > 0
    ) {
      return;
    }

    await unpublishPost(reaction.message.id);
    logger.log(
      `[${this.contentType}] ${this.contentType} ${this.messageLink} is now unpublished.`,
    );
  }
}

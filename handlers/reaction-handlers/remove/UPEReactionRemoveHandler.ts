import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { ContentType } from "@/types";
import { unpublishPost } from "@/data/post";
import { logger } from "@/client";

/**
 * This class is responsible for handling regular reaction removes
 * it is just no oping as the BaseReactionRemoveHandler already takes care of removing
 * the reaction from the database and discord
 */
export class UPERemoveReactionHandler extends BaseReactionRemoveHandler {
  contentType: ContentType = "post";

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    await unpublishPost(reaction.message.id);
    logger.log(`[post] Post ${this.messageLink} is now unpublished.`);
  }
}

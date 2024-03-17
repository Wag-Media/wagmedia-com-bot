import { logger } from "@/client";
import { unfeaturePost } from "@/data/post";
import { ContentType } from "@/types";
import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";

export class FeatureRemoveReactionHandler extends BaseReactionRemoveHandler {
  contentType: ContentType = "post";

  protected async processReaction(reaction, user): Promise<void> {
    await unfeaturePost(reaction.message.id);
    logger.log(`[post] Post ${this.messageLink} is no longer featured.`);
  }

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }
}

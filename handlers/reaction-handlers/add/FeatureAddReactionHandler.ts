import { featurePost } from "@/data/post";
import { CategoryReactionHandler } from "./CategoryReactionHandler";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType } from "@/types";

export class FeatureAddReactionHandler extends BaseReactionAddHandler {
  contentType: ContentType = "post";

  protected async processReaction(reaction, user): Promise<void> {
    await featurePost(reaction.message.id);
    logger.log(`[post] Post ${this.messageLink} is now featured.`);
  }

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }
}

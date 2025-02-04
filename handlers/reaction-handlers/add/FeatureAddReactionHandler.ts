import { featurePost } from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType } from "@/types";
import { featureEvent } from "@/data/event";

export class FeatureAddReactionHandler extends BaseReactionAddHandler {
  contentType: ContentType = "post";

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

  protected async processReaction(reaction, user): Promise<void> {
    if (this.contentType === "post") {
      await featurePost(reaction.message.id);
      logger.log(`[post] Post ${this.messageLink} is now featured.`);
    } else if (this.contentType === "event") {
      await featureEvent(reaction.message.id);
      logger.log(`[event] Event ${this.messageLink} is now featured.`);
    }
  }

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }
}

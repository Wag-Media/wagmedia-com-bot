import { featurePost, publishPost } from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType, PostWithEarnings } from "@/types";

/**
 * 🚥⭕️ superusers🦹 can add universal payment emojis (UPE) to posts
 * 🚥⭕️ adding UPE emojis publishes a post
 * 🚥⭕️ UPE can only be added if there are no other payment emojis
 * 🚥⭕️ after UPE is added to a post, no other payment emojis can be added
 * 🚥⭕️ reacting with the universal publish emoji will publish a (valid) post
  even if it has no payments
 */
export class UPEAddReactionHandler extends BaseReactionAddHandler {
  contentType: ContentType = "post";

  protected async processReaction(reaction, user): Promise<void> {
    await publishPost(reaction.message.id);
    logger.log(
      `[post] Post ${this.messageLink} is now published without any payments.`,
    );
  }

  protected async isReactionPermitted(_, user): Promise<boolean> {
    console.log("UPE IS PERMITTED");
    // can only add UPE if post was not paid before
    if ((this.dbContent as PostWithEarnings).earnings.length > 0) {
      logger.logAndSend(
        `You can't add the universal payment emoji to a post that already has payments.`,
        user,
      );
      throw new Error("Post already has payments");
    }

    return true;
  }
}

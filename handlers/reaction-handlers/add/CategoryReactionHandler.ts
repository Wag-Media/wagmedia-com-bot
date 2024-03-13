import { ContentType, OddJobWithOptions, PostWithOptions } from "@/types";
import { findEmojiCategoryRule } from "@/data/emoji";
import { addCategory } from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { MessageReaction, User } from "discord.js";
import { getPostReactions } from "@/data/reaction";
import { isCountryFlag } from "@/utils/is-country-flag";

import * as config from "@/config";

export class CategoryReactionHandler extends BaseReactionAddHandler {
  contentType: ContentType = "post";

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: User
  ): Promise<boolean> {
    if (
      [
        config.categoryEmojiMap["Non Anglo"],
        config.categoryEmojiMap["Translation"],
      ].includes(this.dbEmoji.id)
    ) {
      const postReactions = await getPostReactions(reaction.message.id);
      // check if the post has a flag
      const hasFlag = postReactions.some((reaction) =>
        isCountryFlag(reaction.emoji?.id)
      );

      if (!hasFlag) {
        logger.logAndSend(
          `Before you can add the non anglo or translation emoji to the published post ${this.messageLink}, make sure it has a flag.`,
          user
        );

        throw new Error("Post is non anglo and has no flag");
      }
    }

    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    const categoryRule = await findEmojiCategoryRule(this.dbEmoji.id);
    if (!categoryRule) {
      throw new Error("Category rule not found");
    }

    // update the local dbMessage with the new category
    this.dbContent = await addCategory(
      reaction.message.id,
      categoryRule.category.id
    );

    logger.log(
      `[category] Category ${categoryRule.category.name} added to ${this.messageLink}.`
    );
  }
}

export class FeatureReactionHandler extends CategoryReactionHandler {
  protected async processReaction(): Promise<void> {
    throw new Error("FeatureReactionHandler: Not implemented");
  }
}

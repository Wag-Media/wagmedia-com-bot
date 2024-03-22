import { ContentType, OddJobWithOptions, PostWithOptions } from "@/types";
import { findEmojiCategoryRule } from "@/data/emoji";
import {
  addCategory,
  getAllCategories,
  postHasCategory,
  setCategory,
} from "@/data/post";
import { logger } from "@/client";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { MessageReaction, User } from "discord.js";
import { getPostReactions } from "@/data/reaction";
import { isCountryFlag } from "@/utils/is-country-flag";

import * as config from "@/config";

export class CategoryAddReactionHandler extends BaseReactionAddHandler {
  contentType: ContentType = "post";

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: User,
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
        isCountryFlag(reaction.emoji?.id),
      );

      if (!hasFlag) {
        logger.logAndSend(
          `Before you can add the non anglo or translation emoji to the published post ${this.messageLink}, make sure it has a flag.`,
          user,
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

    // fetch all category emojis from the message
    const allCategories = await getAllCategories();
    const messageCategoryCount = reaction.message.reactions.cache.filter((r) =>
      allCategories.some((c) => c.emojiId === r.emoji.name),
    ).size;

    const postHasNewsletterCategory = await postHasCategory(
      reaction.message.id,
      config.NEWSLETTER_CATEGORY_NAME,
    );

    // if the count of the post's categories is 1, we can connect the post with the added
    // category and remove all other categories. This can happen in an edge case where the
    // user removed the last category of a published post and then added a new category.
    if (messageCategoryCount === 1 && !postHasNewsletterCategory) {
      this.dbContent = await setCategory(
        reaction.message.id,
        categoryRule.category.id,
      );

      logger.log(
        `[category] Category ${categoryRule.category.name} replaced the old or missing category at ${this.messageLink}.`,
      );
    } else {
      // connect the post with the added category
      // update the local dbMessage with the new category
      this.dbContent = await addCategory(
        reaction.message.id,
        categoryRule.category.id,
      );

      logger.log(
        `[category] Category ${categoryRule.category.name} added to ${this.messageLink}.`,
      );
    }
  }
}

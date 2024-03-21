import { logger } from "@/client";
import { removeCategoryFromPost, unfeaturePost } from "@/data/post";
import { ContentType, PostWithCategories } from "@/types";
import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { findEmojiCategoryRule } from "@/data/emoji";
import { prisma } from "@/utils/prisma";

export class CategoryRemoveReactionHandler extends BaseReactionRemoveHandler {
  contentType: ContentType = "post";

  protected async processReaction(reaction, user): Promise<void> {
    const categoryRule = await findEmojiCategoryRule(this.dbEmoji.id);
    if (!categoryRule) {
      throw new Error("Category rule not found");
    }

    if (!this.dbContent) {
      throw new Error("dbMessage is not defined");
    }

    const post = this.dbContent as PostWithCategories;

    //1. Check if the post has any remaining categories
    const remainingCategories = await prisma.category.findMany({
      where: { posts: { some: { id: post.id } } },
    });

    if (remainingCategories.length > 1) {
      await removeCategoryFromPost(post.id, categoryRule.categoryId);
      logger.log(
        `[category] Category ${categoryRule.category.name} removed from ${this.messageLink}.`
      );
      return;
    } else if (remainingCategories.length === 1) {
      if (post.isPublished) {
        logger.logAndSend(
          `🚨 The category ${categoryRule.category.name} has been removed from the post ${this.messageLink}. The post has no remaining categories but will keep its last category in the db / website until new categories are added.`,
          user,
          "warn"
        );
      } else {
        await removeCategoryFromPost(post.id, categoryRule.categoryId);
      }
    }
  }

  protected async isReactionPermitted(): Promise<boolean> {
    return true;
  }
}

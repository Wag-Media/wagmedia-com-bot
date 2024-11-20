import { MessageReaction, User as DiscordUser } from "discord.js";
import { BaseReactionHandler } from "../_BaseReactionHandler";
import { upsertEntityReaction } from "@/data/reaction";
import { logger } from "@/client";
import { findOrCreateUserFromDiscordUser, findUserById } from "@/data/user";
import { determineEmojiType } from "@/curators/utils";
import { EmojiType } from "@/types";

/**
 * Base class for reaction handlers that handle reaction adds.
 * Takes care of adding reactions to the database and logging the reaction.
 */
export abstract class BaseReactionAddHandler extends BaseReactionHandler {
  //todo what about adding reactions to deleted posts or oddjobs?
  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    await super.initialize(reaction, user);

    if (!this.dbContent && this.contentType !== "thread") {
      throw new Error(
        `Adding emojis to inclomplete ${this.contentType} is not allowed`,
      );
    }

    const emojiType: EmojiType = await determineEmojiType(reaction);

    if (emojiType === "payment") {
      logger.log(
        `[${this.contentType}] Reaction ${reaction.emoji} added to ${this.messageLink} by <@${user.id}>.`,
      );
    } else {
      logger.log(
        `[${this.contentType}] Reaction ${reaction.emoji} added to ${this.messageLink} by ${user.username}#${user.discriminator}.`,
      );
    }

    if (await this.isReactionPermitted(reaction, user)) {
      // threads are a special case that only stores payment reactions and is handled separately
      if (this.contentType !== "thread") {
        // make sure the author is in the db when adding reactions to posts
        if (reaction.message.author) {
          await findOrCreateUserFromDiscordUser(reaction.message.author);
        }

        this.dbReaction = await upsertEntityReaction(
          this.dbContent,
          this.contentType,
          this.dbUser!,
          this.dbEmoji,
        );
      }
    }
  }
}

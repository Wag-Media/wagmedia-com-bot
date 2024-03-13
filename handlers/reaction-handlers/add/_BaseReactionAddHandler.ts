import { MessageReaction, User as DiscordUser } from "discord.js";
import { BaseReactionHandler } from "../_BaseReactionHandler";
import { upsertEntityReaction } from "@/data/reaction";
import { logger } from "@/client";

/**
 * Base class for reaction handlers that handle reaction adds.
 * Takes care of adding reactions to the database and logging the reaction.
 */
export abstract class BaseReactionAddHandler extends BaseReactionHandler {
  //todo what about adding reactions to deleted posts or oddjobs?
  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("BaseReactionAddHandler: Initializing reaction add");
    await super.initialize(reaction, user);
    this.dbReaction = await upsertEntityReaction(
      this.dbContent,
      this.contentType,
      this.dbUser!,
      this.dbEmoji
    );
    logger.log(
      `[${this.contentType}] Reaction ${reaction.emoji} added to ${this.messageLink}`
    );
  }
}

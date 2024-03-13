import { MessageReaction, User as DiscordUser } from "discord.js";
import { BaseReactionHandler } from "../_BaseReactionHandler";
import { deleteEntityReaction, upsertEntityReaction } from "@/data/reaction";
import { logger } from "@/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

/**
 * Base class for reaction handlers that handle reaction removes.
 * Takes care of:
 * - removing reactions from discord
 * - removing reactions from the database
 * - logging the reaction remove
 */
export abstract class BaseReactionRemoveHandler extends BaseReactionHandler {
  //todo what about removing reactions from deleted posts or oddjobs?
  protected async initialize(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    await super.initialize(reaction, user);
    try {
      await deleteEntityReaction(
        this.dbContent,
        this.contentType,
        user.id,
        this.dbEmoji.id
      );
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // if the reaction was already removed, we can ignore the error
        return;
      } else {
        console.warn("error in regularUserReactionRemove", error);
      }
    }
    await reaction.users.remove(user.id);
    logger.log(
      `[${this.contentType}] Reaction ${reaction.emoji} removed from ${this.messageLink}`
    );
  }
}

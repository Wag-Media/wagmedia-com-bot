import { MessageReaction, User as DiscordUser } from "discord.js";
import { BaseReactionHandler } from "../_BaseReactionHandler";
import { deleteEntityReaction } from "@/data/reaction";
import { logger } from "@/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { ReactionTracker } from "@/reaction-tracker";

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
    user: DiscordUser,
  ): Promise<void> {
    await super.initialize(reaction, user);

    //1. remove the reaction from the database
    try {
      await deleteEntityReaction(
        this.dbContent,
        this.contentType,
        user.id,
        this.dbEmoji.id || this.dbEmoji.discordId || "",
      );
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        // if the reaction was already removed, we can ignore the error
        console.log("reaction already removed", error);
        return;
      } else {
        console.warn("error in regularUserReactionRemove", error);
      }
    }
    ReactionTracker.addReactionToTrack(reaction, user.id);

    //2. remove the reaction from discord
    await reaction.users?.remove(user.id);

    logger.log(
      `[${this.contentType}] Reaction ${reaction.emoji.name || reaction.emoji.id} by ${user.username}#${user.discriminator} removed from ${this.messageLink}.`,
    );
  }
}

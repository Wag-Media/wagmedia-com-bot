import { MessageReaction, User as DiscordUser, Message } from "discord.js";
import { ReactionHandlerFactory } from "./reaction-handler-factory";
import { logger } from "@/client";
import { ReactionTracker } from "@/reaction-tracker";
import { ReactionDiscrepancyResolver } from "./discrepancy-resolver";

export class ReactionCurator {
  static isResolvingDiscrepancies = false;

  static async curateAdd(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    // the index.ts fetches PartialMessages so this is safe
    const message = reaction.message as Message;

    // Only check for discrepancies if not currently resolving them
    if (!this.isResolvingDiscrepancies) {
      this.isResolvingDiscrepancies = true;
      await ReactionDiscrepancyResolver.checkAndResolve(message);
      this.isResolvingDiscrepancies = false;
    }

    try {
      const handler = await ReactionHandlerFactory.getHandler(
        reaction,
        user,
        "reactionAdd"
      );
      await handler.handle(reaction, user);
    } catch (error) {
      ReactionTracker.addReactionToTrack(reaction);
      await reaction.users.remove(user.id);
      this.curateRemove(reaction, user);
    }
  }

  static async curateRemove(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    try {
      const handler = await ReactionHandlerFactory.getHandler(
        reaction,
        user,
        "reactionRemove"
      );
      await handler.handle(reaction, user);
    } catch (error) {
      console.error("Error handling reaction:", error);
    }
  }
}

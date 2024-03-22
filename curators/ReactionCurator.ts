import { MessageReaction, User as DiscordUser, Message } from "discord.js";
import { ReactionHandlerFactory } from "../handlers/ReactionHandlerFactory";
import { ReactionTracker } from "@/reaction-tracker";
import { ReactionDiscrepancyResolver } from "./ReactionDiscrepancyResolver";
import { logger } from "@/client";
import { classifyMessage, shouldIgnoreMessage } from "@/handlers/util";
import { determineContentType } from "./utils";

export class ReactionCurator {
  static isResolvingDiscrepancies = false;

  static async curateAdd(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    // the index.ts fetches PartialMessages so this is safe
    const message = reaction.message as Message;
    const { contentType } = determineContentType(message);

    console.log("curateAdd contentType", contentType);

    if (!contentType || shouldIgnoreMessage(message)) {
      return;
    }

    // Only check for discrepancies if not currently resolving them
    if (!this.isResolvingDiscrepancies) {
      this.isResolvingDiscrepancies = true;
      const hadDiscrepancies =
        await ReactionDiscrepancyResolver.checkAndResolve(
          message,
          "reactionAdd",
        );
      this.isResolvingDiscrepancies = false;

      if (hadDiscrepancies) {
        return;
      }
    }

    try {
      const handler = await ReactionHandlerFactory.getHandler(
        reaction,
        user,
        "reactionAdd",
      );
      await handler.handle(reaction, user);
    } catch (error) {
      console.error("Error handling reaction:", error);
      // track the reaction = label it as removed by the bot so it wont be handled again
      // in the messageReactionRemove events
      ReactionTracker.addReactionToTrack(reaction, user.id);

      // remove any reaction if an error occured
      await reaction.users.remove(user.id);

      // and also side effects (e.g. remove the reaction from the db)
      await this.curateRemove(reaction, user);
    }
  }

  static async curateRemove(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    const { messageChannelType } = classifyMessage(reaction.message);

    if (!messageChannelType || shouldIgnoreMessage(reaction.message)) {
      return;
    }

    try {
      const handler = await ReactionHandlerFactory.getHandler(
        reaction,
        user,
        "reactionRemove",
      );
      await handler.handle(reaction, user);
    } catch (error) {
      console.error("Error handling reaction:", error);
    }

    // const message = reaction.message as Message;

    // // Only check for discrepancies if not currently resolving them
    // if (!this.isResolvingDiscrepancies) {
    //   this.isResolvingDiscrepancies = true;
    //   const hadDiscrepancies =
    //     await ReactionDiscrepancyResolver.checkAndResolve(
    //       message,
    //       "reactionRemove"
    //     );
    //   this.isResolvingDiscrepancies = false;

    //   if (hadDiscrepancies) {
    //     console.log("discrepancies were handled, returning");
    //     return;
    //   }
    // }

    // try {
    //   const handler = await ReactionHandlerFactory.getHandler(
    //     reaction,
    //     user,
    //     "reactionRemove"
    //   );
    //   await handler.handle(reaction, user);
    // } catch (error) {
    //   logger.error("Error handling reaction:", error.message);
    // }
  }
}

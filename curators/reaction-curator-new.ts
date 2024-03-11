import { MessageReaction, User as DiscordUser } from "discord.js";
import { ReactionHandlerFactory } from "./reaction-handler-factory";

export class ReactionCurator {
  static async curateAdd(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    try {
      const handler = await ReactionHandlerFactory.getHandler(
        reaction,
        user,
        "reactionAdd"
      );
      await handler.handle(reaction, user);
    } catch (error) {
      console.error("Error handling reaction:", error);
    }
  }
}

import { MessageReaction, User as DiscordUser } from "discord.js";
import {
  IReactionHandler,
  ReactionHandler,
} from "./interface-reaction-handler";

export class PostPaymentReactionHandler implements IReactionHandler {
  public async handle(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("Handling payment reaction for a post");
  }
}

export class OddJobPaymentReactionHandler implements IReactionHandler {
  public async handle(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    console.log("Handling payment reaction for a oddjob");
  }
}

import { MessageReaction, User as DiscordUser } from "discord.js";

export interface IReactionHandler {
  handle(reaction: MessageReaction, user: DiscordUser): Promise<void>;
}

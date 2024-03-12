import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./interface-reaction-handler";
import { logger } from "@/client";
import { BaseReactionHandler } from "./base-handlers";

export class NotAllowedReactionHandler extends BaseReactionHandler {
  private readonly message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }

  protected async processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    await logger.logAndSend(`${this.message} ${this.messageLink}`, user);
    throw new Error(this.message);
  }
}

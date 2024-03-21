import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./_IReactionHandler";
import { logger } from "@/client";
import { BaseReactionHandler } from "./_BaseReactionHandler";
import { ContentType } from "@/types";

export class NotAllowedReactionHandler extends BaseReactionHandler {
  contentType: ContentType;
  private readonly message: string;

  constructor(message: string) {
    super();
    this.message = message;
  }

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<boolean> {
    await logger.logAndSend(`${this.message} ${this.messageLink}`, user);
    throw new Error(this.message);
  }

  protected processReaction(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    // no-op
    return Promise.resolve();
  }
}

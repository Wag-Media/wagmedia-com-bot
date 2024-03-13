import { MessageReaction, User } from "discord.js";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType } from "@/types";

export class RegularReactionAddHandler extends BaseReactionAddHandler {
  contentType: ContentType;

  constructor(contentType: ContentType) {
    super();
    this.contentType = contentType;
  }

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: User
  ): Promise<boolean> {
    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    // noop
  }
}

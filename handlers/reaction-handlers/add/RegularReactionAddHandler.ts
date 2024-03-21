import { MessageReaction, User } from "discord.js";
import { BaseReactionAddHandler } from "./_BaseReactionAddHandler";
import { ContentType, UserRole } from "@/types";
import { logger } from "@/client";
import { isCountryFlag } from "@/utils/is-country-flag";

export class RegularReactionAddHandler extends BaseReactionAddHandler {
  contentType: ContentType;
  userRole: UserRole;

  constructor(contentType: ContentType, userRole: UserRole) {
    super();
    this.contentType = contentType;
    this.userRole = userRole;
  }

  protected async isReactionPermitted(
    reaction: MessageReaction,
    user: User,
  ): Promise<boolean> {
    if (this.userRole !== "superuser") {
      if (reaction.emoji.name?.includes("WM")) {
        logger.logAndSend(
          `You do not have permission to add WagMedia emojis to ${this.messageLink}`,
          user,
        );
        throw new Error("Regular user adding WagMedia emoji");
      } else if (isCountryFlag(reaction.emoji.name)) {
        logger.logAndSend(
          `You do not have permission to add country flag emojis to ${this.messageLink}`,
          user,
        );
        throw new Error("Regular user adding country flag emoji");
      }
    }
    return true;
  }

  protected async processReaction(reaction, user): Promise<void> {
    // noop as reaction is added to db in base class
  }
}

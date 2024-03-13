import { MessageReaction, User } from "discord.js";
import { BaseReactionRemoveHandler } from "./_BaseReactionRemoveHandler";
import { ContentType } from "@/types";

/**
 * This class is responsible for handling regular reaction removes
 * it is just no oping as the BaseReactionRemoveHandler already takes care of removing
 * the reaction from the database and discord
 */
export class RegularReactionRemoveHandler extends BaseReactionRemoveHandler {
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

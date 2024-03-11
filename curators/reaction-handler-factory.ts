import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./interface-reaction-handler";
import {
  OddJobPaymentReactionHandler,
  PostPaymentReactionHandler,
} from "./payment-handlers";
import { EmojiType, ReactionEventType } from "@/types";
import {
  determineContentType,
  determineEmojiType,
  determineUserRole,
} from "./utils";
import { ensureFullMessage } from "@/handlers/util";

export class ReactionHandlerFactory {
  static async getHandler(
    reaction: MessageReaction,
    user: DiscordUser,
    eventType: ReactionEventType
  ): Promise<IReactionHandler> {
    const { message } = await ensureFullMessage(reaction.message);
    // Determine the type of content (e.g., post, oddjob, thread)
    const contentType = determineContentType(message);
    // and the user role (e.g., poweruser, regularuser)
    const userRole = await determineUserRole(message, user);
    // and the emoji type
    const emojiType: EmojiType = await determineEmojiType(reaction);

    // select the appropriate handler based on
    // - the content type
    // - the user role
    // - the emoji type
    // - the event type (e.g., reaction added, reaction removed)
    if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "post"
    ) {
      return new PostPaymentReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "oddjob"
    ) {
      return new OddJobPaymentReactionHandler();
    } else {
      // Return a default handler or throw an error
      throw new Error(
        `No handlers found for content type ${contentType}, user role ${userRole}, emoji type ${emojiType}, and event type ${eventType}`
      );
    }
  }
}

import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./reaction-handlers/_IReactionHandler";
import {
  OddJobPaymentReactionHandler,
  PostPaymentReactionHandler,
  ThreadPaymentReactionHandler,
} from "./reaction-handlers/add/PaymentReactionHandler";
import { EmojiType, ReactionEventType } from "@/types";
import {
  determineContentType,
  determineEmojiType,
  determineUserRole,
} from "../curators/utils";
import { ensureFullMessage } from "@/handlers/util";
import { NotAllowedReactionHandler } from "./reaction-handlers/NotAllowedReactionHandler";
import { ReactionDiscrepancyResolver } from "../curators/ReactionDiscrepancyResolver";
import { CategoryReactionHandler } from "./reaction-handlers/add/CategoryReactionHandler";
import { RegularReactionAddHandler } from "./reaction-handlers/add/RegularReactionAddHandler";
import { RegularReactionRemoveHandler } from "./reaction-handlers/remove/RegularReactionRemoveHandler";

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
    // - the user role
    // - the content type
    // - the emoji type
    // - the event type (e.g., reaction added, reaction removed)

    if (
      // ---- Superuser ----
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "category" &&
      contentType.contentType === "post"
    ) {
      return new CategoryReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "category" &&
      contentType.contentType !== "post"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use category emojis in oddjobs or threads.`
      );
    } else if (
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
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "thread"
    ) {
      return new ThreadPaymentReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "post"
    ) {
      console.log("superuser reactionRemove post");
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "oddjob"
    ) {
      console.log("superuser reactionRemove oddjob");
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "thread"
    ) {
      console.log("superuser reactionRemove thread");
    } else if (
      // ---- Regular user -----
      userRole === "regular" &&
      emojiType === "payment"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use payment emojis.`
      );
    } else if (userRole === "regular" && emojiType === "category") {
      return new NotAllowedReactionHandler(
        `You are not allowed to use category emojis.`
      );
    } else if (userRole === "regular" && emojiType === "feature") {
      return new NotAllowedReactionHandler(
        `You are not allowed to use feature emojis.`
      );
    } else if (eventType === "reactionAdd" && emojiType === "regular") {
      // ---- Regular Emojis Add ----
      return new RegularReactionAddHandler(contentType.contentType);
    } else if (eventType === "reactionRemove" && emojiType === "regular") {
      // ---- Regular Emojis Remove ----
      return new RegularReactionRemoveHandler(contentType.contentType);
    } else {
      // Return a default handler or throw an error
      throw new Error(
        `No handlers found for contentType:${contentType.contentType}, userRole:${userRole}, emojiType:${emojiType}, and eventType:${eventType}`
      );
    }
  }
}

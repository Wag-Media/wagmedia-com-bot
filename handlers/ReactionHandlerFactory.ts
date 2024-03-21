import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./reaction-handlers/_IReactionHandler";
import {
  OddJobPaymentReactionAddHandler,
  PostPaymentReactionAddHandler,
  ThreadPaymentReactionAddHandler,
} from "./reaction-handlers/add/PaymentReactionAddHandler";
import { EmojiType, ReactionEventType } from "@/types";
import {
  determineContentType,
  determineEmojiType,
  determineUserRole,
} from "../curators/utils";
import { ensureFullMessage } from "@/handlers/util";
import { NotAllowedReactionHandler } from "./reaction-handlers/NotAllowedReactionHandler";
import { ReactionDiscrepancyResolver } from "../curators/ReactionDiscrepancyResolver";
import { CategoryAddReactionHandler } from "./reaction-handlers/add/CategoryAddReactionHandler";
import { RegularReactionAddHandler } from "./reaction-handlers/add/RegularReactionAddHandler";
import { RegularReactionRemoveHandler } from "./reaction-handlers/remove/RegularReactionRemoveHandler";
import { NoopReactionHandler } from "./reaction-handlers/NoopReactionHandler";
import { FeatureAddReactionHandler } from "./reaction-handlers/add/FeatureAddReactionHandler";
import { FeatureRemoveReactionHandler } from "./reaction-handlers/remove/FeatureRemoveReactionHandler";
import {
  OddJobPaymentReactionRemoveHandler,
  PostPaymentReactionRemoveHandler,
  ThreadPaymentReactionRemoveHandler,
} from "./reaction-handlers/remove/PaymentReactionRemoveHandler";
import { CategoryRemoveReactionHandler } from "./reaction-handlers/remove/CategoryRemoveReactionHandler";

export class ReactionHandlerFactory {
  static async getHandler(
    reaction: MessageReaction,
    user: DiscordUser,
    eventType: ReactionEventType,
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
      return new CategoryAddReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "category" &&
      contentType.contentType !== "post"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use category emojis in oddjobs or threads.`,
      );
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "post"
    ) {
      return new PostPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "oddjob"
    ) {
      return new OddJobPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType.contentType === "thread"
    ) {
      return new ThreadPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "feature" &&
      contentType.contentType === "post"
    ) {
      return new FeatureAddReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "feature" &&
      contentType.contentType !== "post"
    ) {
      return new NotAllowedReactionHandler(
        `Feature emojis can only be added to posts`,
      );
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "feature" &&
      contentType.contentType === "post"
    ) {
      return new FeatureRemoveReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "category" &&
      contentType.contentType === "post"
    ) {
      return new CategoryRemoveReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "post"
    ) {
      return new PostPaymentReactionRemoveHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "oddjob"
    ) {
      return new OddJobPaymentReactionRemoveHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType.contentType === "thread"
    ) {
      return new ThreadPaymentReactionRemoveHandler();
    } else if (
      // ---- Regular user -----
      userRole === "regular" &&
      emojiType === "payment" &&
      eventType === "reactionAdd"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use payment emojis.`,
      );
    } else if (
      userRole === "regular" &&
      emojiType === "category" &&
      eventType === "reactionAdd"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use category emojis.`,
      );
    } else if (
      userRole === "regular" &&
      emojiType === "feature" &&
      eventType === "reactionAdd"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use feature emojis.`,
      );
    } else if (
      userRole === "regular" &&
      eventType === "reactionRemove" &&
      ["category", "feature", "payment"].includes(emojiType)
    ) {
      return new NoopReactionHandler();
    } else if (eventType === "reactionAdd" && emojiType === "regular") {
      // ---- Regular Emojis Add ----
      return new RegularReactionAddHandler(contentType.contentType, userRole);
    } else if (eventType === "reactionRemove" && emojiType === "regular") {
      // ---- Regular Emojis Remove ----
      return new RegularReactionRemoveHandler(contentType.contentType);
    } else {
      // Return a default handler or throw an error
      throw new Error(
        `No handlers found for contentType:${contentType.contentType}, userRole:${userRole}, emojiType:${emojiType}, and eventType:${eventType}`,
      );
    }

    //satisfying the linter
    return new NotAllowedReactionHandler(
      `You have no permission to use this emoji.`,
    );
  }
}

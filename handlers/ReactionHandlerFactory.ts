import { MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./reaction-handlers/_IReactionHandler";
import {
  EventPaymentReactionAddHandler,
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
import { UPEAddReactionHandler } from "./reaction-handlers/add/UPEAddReactionHandler";
import { UPERemoveReactionHandler } from "./reaction-handlers/remove/UPEReactionRemoveHandler";

export class ReactionHandlerFactory {
  static async getHandler(
    reaction: MessageReaction,
    user: DiscordUser,
    eventType: ReactionEventType,
  ): Promise<IReactionHandler> {
    const { message } = await ensureFullMessage(reaction.message);

    // Determine the type of content (e.g., post, oddjob, thread)
    const { contentType } = determineContentType(message);

    console.log(`reactionHandlerFactory: contentType: ${contentType}`);
    // and the user role (e.g., poweruser, regularuser)
    const userRole = await determineUserRole(message, user);

    // and the emoji type
    const emojiType: EmojiType = await determineEmojiType(reaction);

    if (!contentType || !contentType || !userRole || !emojiType) {
      throw new Error(
        `Could not determine content type, user role, or emoji type.`,
      );
    }

    console.log(
      `ReactionHandlerFactory.getHandler: contentType=${contentType}, userRole=${userRole}, emojiType=${emojiType}, eventType=${eventType}, user=${user.username}`,
    );

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
      ["post", "newsletter"].includes(contentType)
    ) {
      return new CategoryAddReactionHandler(contentType);
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "category" &&
      !["post", "newsletter"].includes(contentType)
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use category emojis in oddjobs, threads, or events.`,
      );
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType === "post"
    ) {
      return new PostPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType === "oddjob"
    ) {
      return new OddJobPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType === "thread"
    ) {
      return new ThreadPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "payment" &&
      contentType === "event"
    ) {
      return new EventPaymentReactionAddHandler();
    } else if (
      userRole === "superuser" &&
      ["reactionAdd", "reactionRemove"].includes(eventType) &&
      emojiType === "payment" &&
      contentType === "newsletter"
    ) {
      return new NotAllowedReactionHandler(
        `${eventType}ing a payment emoji for a newsletter post is not allowed.`,
      );
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "feature" &&
      ["post", "newsletter", "event"].includes(contentType)
    ) {
      return new FeatureAddReactionHandler(contentType);
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "universalPublish" &&
      ["post", "newsletter"].includes(contentType)
    ) {
      return new UPEAddReactionHandler(contentType);
    } else if (
      userRole === "superuser" &&
      eventType === "reactionAdd" &&
      emojiType === "feature" &&
      !["post", "newsletter", "event"].includes(contentType)
    ) {
      return new NotAllowedReactionHandler(
        `Feature emojis can only be added to posts or newsletters or events`,
      );
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "feature" &&
      ["post", "event"].includes(contentType)
    ) {
      return new FeatureRemoveReactionHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "universalPublish" &&
      ["post", "newsletter"].includes(contentType)
    ) {
      return new UPERemoveReactionHandler(contentType);
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "category" &&
      ["post", "newsletter"].includes(contentType)
    ) {
      return new CategoryRemoveReactionHandler(contentType);
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType === "post"
    ) {
      return new PostPaymentReactionRemoveHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType === "oddjob"
    ) {
      return new OddJobPaymentReactionRemoveHandler();
    } else if (
      userRole === "superuser" &&
      eventType === "reactionRemove" &&
      emojiType === "payment" &&
      contentType === "thread"
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
      emojiType === "universalPublish" &&
      eventType === "reactionAdd"
    ) {
      return new NotAllowedReactionHandler(
        `You are not allowed to use the universal publish emoji.`,
      );
    } else if (
      userRole === "regular" &&
      eventType === "reactionRemove" &&
      ["category", "feature", "universalPublish", "payment"].includes(emojiType)
    ) {
      return new NoopReactionHandler();
    } else if (eventType === "reactionAdd" && emojiType === "regular") {
      // ---- Regular Emojis Add ----
      return new RegularReactionAddHandler(contentType, userRole);
    } else if (eventType === "reactionRemove" && emojiType === "regular") {
      // ---- Regular Emojis Remove ----
      return new RegularReactionRemoveHandler(contentType);
    } else {
      // Return a default handler or throw an error
      throw new Error(
        `No handlers found for contentType:${contentType}, userRole:${userRole}, emojiType:${emojiType}, and eventType:${eventType}`,
      );
    }

    //satisfying the linter
    return new NotAllowedReactionHandler(
      `You have no permission to use this emoji.`,
    );
  }
}

import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User as DiscordUser,
  Message,
  PartialMessage,
  TextChannel,
  Channel,
  ThreadChannel,
} from "discord.js";
import * as config from "../config.js";
import { logger } from "@/client.js";

/**
 * Just a simple delay function.
 * @param ms
 * @returns
 */
export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Slugify a string.
 * @param text
 * @returns
 */
export function slugify(text: string) {
  return `${text}-${Date.now()}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

/**
 * See shouldIgnoreMessage
 * @param reaction
 * @param user
 * @returns
 */
export function shouldIgnoreReaction(
  reaction: MessageReaction | PartialMessageReaction
): boolean {
  return shouldIgnoreMessage(reaction.message);
}

/**
 * Check if a message should be ignored. Ignore:
 * - not from a monitored channel or category
 * - bot reactions
 * - DMs
 * - from all other channels
 * Except, allow messages from bots with a specific role ("The Concierge").
 * @param message
 * @returns
 */
export function shouldIgnoreMessage(
  message: Message<boolean> | PartialMessage
) {
  // Ignore DMs
  if (!message.guild) return true;

  // Directly check if the message author is a bot and if so, check for "The Concierge" role
  if (message.author?.bot) {
    // Allow bot messages if the bot has "The Concierge" role
    const member = message.member;
    if (
      member &&
      !member.roles.cache.some((role) =>
        [
          "The Concierge",
          "WagMedia Com Bot Production",
          "WagMedia Communication Bot",
        ].includes(role.name)
      )
    ) {
      console.log("ignoreing bot message because it does not have the role");
      return true; // Bot does not have the role, ignore the message
    } else if (!member) {
      console.log("ignoreing bot message because member is null");
      return true; // If member information is not available, default to ignoring the bot message
    }
    // If the bot has the role, the function will continue and not return true here

    console.log(
      "allowing bot message because it has the role",
      member.roles.cache
    );
  }

  // Ignore reactions from other channels
  const channel = message.channel;
  if (!(channel instanceof TextChannel || channel instanceof ThreadChannel))
    return true;

  if (
    !isMessageFromMonitoredChannel(channel) &&
    !isMessageFromOddJobsChannel(channel) &&
    !isMessageFromMonitoredCategory(channel) &&
    !isParentMessageFromMonitoredCategoryOrChannel(message)
  )
    return true;

  return false;
}

export async function ensureFullMessage(
  message: Message<boolean> | PartialMessage
): Promise<Message> {
  if (message.partial) {
    try {
      message = (await message.fetch()) as Message;
    } catch (error) {
      logger.error("Something went wrong when fetching the message:", error);
      throw new Error("Something went wrong when fetching the message:");
    }
  }

  return message;
}

/**
 * Ensure that the message, reaction and user are fully cached.
 * @param reaction
 * @param user
 * @returns
 */
export async function ensureFullEntities(
  reaction: MessageReaction | PartialMessageReaction | null,
  user: DiscordUser | PartialUser | null
): Promise<{
  reaction: MessageReaction;
  user: DiscordUser;
}> {
  if (!reaction) {
    throw new Error("Reaction is null");
  }
  if (!user) {
    throw new Error("User is null");
  }

  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch (error) {
      logger.error("Something went wrong when fetching the message:", error);
      throw new Error("Something went wrong when fetching the message:");
    }
  }

  if (reaction.partial) {
    try {
      reaction = (await reaction.fetch()) as MessageReaction;
    } catch (error) {
      logger.error("Something went wrong when fetching the reaction:", error);
      throw new Error("Something went wrong when fetching the reaction:");
    }
  }

  if (user.partial) {
    try {
      user = (await user.fetch()) as DiscordUser;
    } catch (error) {
      logger.error("Something went wrong when fetching the user:", error);
      throw new Error("Something went wrong when fetching the user:");
    }
  }

  return {
    reaction: reaction as MessageReaction,
    user: user as DiscordUser,
  };
}

export const isMessageFromMonitoredChannel = (channel: Channel) =>
  config.CHANNELS_TO_MONITOR.includes(channel.id);

export const isMessageFromOddJobsChannel = (channel: Channel) =>
  config.CHANNELS_ODD_JOBS.includes(channel.id);

export const isMessageFromMonitoredCategory = (channel: Channel) =>
  channel instanceof TextChannel &&
  channel.parentId &&
  config.CATEGORIES_TO_MONITOR.includes(channel.parentId);

export const isParentMessageFromMonitoredCategoryOrChannel = (
  message: Message<boolean> | PartialMessage
) => {
  if (message.channel.isThread()) {
    // Access thread details
    const parent = message.channel.parent;
    return (
      parent &&
      (isMessageFromMonitoredChannel(parent) ||
        isMessageFromMonitoredCategory(parent))
    );
  }
  return false;
};

/**
 * Parses a Discord user mention and extracts the user ID.
 * @param message The message containing the user mention.
 * @returns The Discord user ID if found, otherwise null.
 */
export function parseDiscordUserId(message: string): string | null {
  const mentionRegex = /<@!?(\d+)>/;
  const match = message.match(mentionRegex);

  return match ? match[1] : null;
}

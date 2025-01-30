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
  Guild,
} from "discord.js";
import * as config from "@/config";
import { discordClient, logger } from "@/client";
import { findEmojiCategoryRule, findEmojiPaymentRule } from "@/data/emoji";
import { Emoji } from "@prisma/client";
import { EmojiType } from "@/types";
import validator from "validator";

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
  reaction: MessageReaction | PartialMessageReaction,
): boolean {
  return shouldIgnoreMessage(reaction.message);
}

/**
 *
 * TODO can this be removed?
 * Check if a message should be ignored. Ignore:
 * - not from a monitored channel or category
 * - bot reactions
 * - DMs
 * - from not text or thread channels
 * @param message
 * @param user
 * @returns
 */
export function shouldIgnoreMessage(message: Message | PartialMessage) {
  const user = message.author;
  // Ignore DMs
  if (!message.guild && !message.guildId) return true;

  // if (user?.bot || message.author?.bot) {
  //   console.log("message is from bot");
  //   console.log("user.bot", user?.bot);
  //   console.log("message.author.bot", message.author?.bot);
  // }

  // Ignore bot messages or reactions to bot messages
  if (!user || user.bot || message.author?.bot) return true;

  // Ignore reactions from non text or thread channels
  const channel = message.channel;

  if (!(channel instanceof TextChannel || channel instanceof ThreadChannel))
    return true;

  return false;
}

export async function classifyReaction(dbEmoji: Emoji): Promise<EmojiType> {
  // 1. Check for Feature Rule
  if (dbEmoji.name === config.FEATURE_EMOJI) {
    return "feature";
  }

  // 2. Check for Category Rule
  const categoryRule = await findEmojiCategoryRule(dbEmoji.id);
  if (categoryRule) {
    return "category";
  }

  // 3. Check for Payment Rule
  const paymentRule = await findEmojiPaymentRule(dbEmoji.id);
  if (paymentRule) {
    return "payment";
  }

  return "regular";
}

export async function ensureFullMessage(
  message: Message<boolean> | PartialMessage,
): Promise<{ message: Message; wasPartial: boolean }> {
  let wasPartial = false;
  if (message.partial) {
    wasPartial = true;
    try {
      message = (await message.fetch()) as Message;
    } catch (error) {
      logger.error(
        "Something went wrong when fetching the partial message:",
        error,
      );
      throw new Error(
        "Something went wrong when fetching the partial message:",
      );
    }
  }

  return { message, wasPartial };
}

/**
 * Ensure that the message, reaction and user are fully cached.
 * @param reaction
 * @param user
 * @returns
 */
export async function ensureFullEntities(
  reaction: MessageReaction | PartialMessageReaction | null,
  user: DiscordUser | PartialUser | null,
): Promise<{
  reaction: MessageReaction;
  user: DiscordUser;
  wasPartial: { reaction: boolean; message: boolean; user: boolean };
}> {
  let wasPartial = {
    reaction: false,
    message: false,
    user: false,
  };

  if (!reaction) {
    throw new Error("Reaction is null");
  }
  if (!user) {
    throw new Error("User is null");
  }

  if (reaction.partial) {
    console.log("reaction was partial");
    wasPartial.reaction = true;
    try {
      reaction = (await reaction.fetch()) as MessageReaction;
    } catch (error) {
      logger.error("Something went wrong when fetching the reaction:", error);
      throw new Error("Something went wrong when fetching the reaction:");
    }
  }

  if (reaction.message.partial) {
    console.log("reaction.message was partial");
    wasPartial.message = true;
    try {
      reaction.message = await reaction.message.fetch();
    } catch (error) {
      logger.error("Something went wrong when fetching the message:", error);
      throw new Error("Something went wrong when fetching the message:");
    }
  }

  if (user.partial) {
    console.log("user was partial");
    wasPartial.user = true;
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
    wasPartial,
  };
}

export const isChannelMonitoredForPosts = (channel: Channel) =>
  config.CHANNELS_TO_MONITOR.includes(channel.id);

export const isChannelMonitoredForOddJobs = (channel: Channel) =>
  config.CHANNELS_ODD_JOBS.includes(channel.id);

export const isCategoryMonitoredForPosts = (channel: Channel) =>
  channel instanceof TextChannel &&
  channel.parentId &&
  config.CATEGORIES_TO_MONITOR.includes(channel.parentId);

export const isChannelMonitoredForNewsletter = (channel: Channel) =>
  channel instanceof TextChannel &&
  config.CHANNELS_NEWSLETTER.includes(channel.id);

export const isChannelMonitoredForEvents = (channel: Channel) =>
  channel instanceof TextChannel && config.CHANNELS_EVENTS.includes(channel.id);

export const isParentMessageFromMonitoredCategoryOrChannel = (
  message: Message<boolean> | PartialMessage,
) => {
  if (message.channel.isThread()) {
    // Access thread details
    const parent = message.channel.parent;
    return (
      parent &&
      (isChannelMonitoredForPosts(parent) ||
        isCategoryMonitoredForPosts(parent))
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

export async function getGuildFromMessage(
  message: Message | PartialMessage,
): Promise<Guild> {
  if (!message.guildId) {
    throw new Error("Message must have a guildId");
  }
  // Set the guild from the reaction message, which might involve fetching it if not readily available
  const guild =
    message.guild ||
    (await discordClient.guilds.fetch(message.guildId as string));

  return guild;
}

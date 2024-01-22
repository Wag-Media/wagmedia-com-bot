import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User as DiscordUser,
  Message,
  PartialMessage,
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
 * Check if a reaction should be ignored. Ignore:
 * - not from a monitored channel
 * - bot reactions
 * - DMs
 * @param reaction
 * @param user
 * @returns
 */
export function shouldIgnoreReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: DiscordUser | PartialUser
): boolean {
  // Check if the reaction is in the channel we are interested in
  if (!config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id))
    return true;

  // Ignore bot reactions
  if (user.bot) return true;

  // Ignore DMs
  if (!reaction.message.guild) return true;

  return false;
}

export function shouldIgnoreMessage(
  message: Message<boolean> | PartialMessage
) {
  // Ignore DMs
  if (!message.guild) return true;

  // Ignore bot messages
  if (message.author?.bot) return true;

  // Ignore messages from channels we are not interested in
  if (!config.CHANNELS_TO_MONITOR.includes(message.channel.id)) return true;

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

import { logger } from "@/client";
import { Message } from "discord.js";
import { parseEventFromDiscord } from "./parse-event";
import { PostEmbed } from "@/types";
import { PolkadotEventWithTagsEmbeds } from "@/types";
import { findOrCreateEvent } from "@/data/event";

export interface EventType {
  title: string | null;
  description: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  isAllDay: boolean;
  location: string | null;
  link: string | null;
  image: string | null;
  discordLink: string | null;
  recurrenceRule: string | null;
  recurrenceEndDate: Date | null;
  timezone: string | null;
  embeds: PostEmbed[];
  tags: string[];
}

export async function handleEvent(
  message: Message<boolean>,
  messageLink: string,
): Promise<PolkadotEventWithTagsEmbeds | undefined> {
  try {
    const parsedEvent = parseEventFromDiscord(message);
    console.log(parsedEvent);

    if (!parsedEvent) {
      logger.error(`there was an error when parsing ${messageLink}`);
      return;
    }

    // Add Discord-specific data
    const eventWithDiscordData: EventType = {
      ...parsedEvent,
      discordLink: messageLink,
      embeds: message.embeds.map((embed) => ({
        url: embed.url || null,
        imageUrl:
          embed.image?.proxyURL ||
          embed.image?.url ||
          embed.thumbnail?.url ||
          embed.thumbnail?.proxyURL ||
          null,
        width: embed.image?.width || embed.thumbnail?.width || null,
        height: embed.image?.height || embed.thumbnail?.height || null,
        color: embed.color || null,
      })),
    };

    // Validate required fields
    const validationErrors = validateEvent(eventWithDiscordData);
    if (validationErrors.length > 0) {
      logger.logAndSend(
        `[event] Please fix the following errors in your event ${messageLink}:\n${validationErrors.map((error) => `• ${error}`).join("\n")}`,
        message.author,
        "warn",
      );
      return;
    }

    logger.log(
      `[event] New valid event by ${message.member?.displayName} in ${messageLink}: ${eventWithDiscordData.title}`,
    );

    const event = await findOrCreateEvent({
      ...eventWithDiscordData,
      message,
    });

    return event;
  } catch (error) {
    logger.error(`Error handling event from ${messageLink}:`, error);
    return undefined;
  }
}

function validateEvent(event: EventType): string[] {
  const errors: string[] = [];

  if (!event.title?.trim()) errors.push("title is required");

  if (!event.description?.trim()) errors.push("description is required");

  if (!event.startsAt) errors.push("start date is required");

  if (!event.location?.trim()) errors.push("location is required");

  if (!event.tags?.length) errors.push("at least one tag is required");

  if (!event.link?.trim()) errors.push("link is required");
  else {
    try {
      new URL(event.link);
    } catch {
      errors.push("link must be a valid URL");
    }
  }

  // Optional: Validate date relationships
  if (event.startsAt && event.endsAt && event.startsAt > event.endsAt)
    errors.push("end date must be after start date");

  return errors;
}

export function isEventValid(event: EventType): boolean {
  return validateEvent(event).length === 0;
}

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
    const missingFields = validateEvent(eventWithDiscordData);
    if (missingFields.length > 0) {
      logger.warn(
        `[event] Event ${messageLink} is missing required fields: ${missingFields.join(", ")}`,
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
  const missingFields: string[] = [];

  if (!event.title) missingFields.push("title");
  if (!event.description) missingFields.push("description");
  if (!event.startsAt) missingFields.push("date");
  if (!event.location) missingFields.push("location");
  if (!event.tags) missingFields.push("tags");
  if (!event.link) missingFields.push("link");

  return missingFields;
}

export function isEventValid(event: EventType): boolean {
  return validateEvent(event).length === 0;
}

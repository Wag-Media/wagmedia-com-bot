import { EventType } from "@/utils/handle-event";
import { findOrCreateUser } from "./user";
import { Message } from "discord.js";
import { replaceAuthorLinks } from "@/utils/replace-author-links";
import { slugify } from "@/handlers/util";
import { PolkadotEvent } from "@prisma/client";
import { prisma } from "@/utils/prisma";

export async function findOrCreateEvent(
  eventData: EventType & { message: Message },
) {
  const { message, title, description, startsAt, tags } = eventData;

  if (!message) {
    throw new Error("Message must be defined");
  }

  if (!title) {
    throw new Error("Title must be defined");
  }
  if (!description) {
    throw new Error("Description must be defined");
  }
  if (!startsAt) {
    throw new Error("Starts at must be defined");
  }
  const user = await findOrCreateUser(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  const tagInstances = await Promise.all(
    tags.map(async (tag) => {
      return prisma.tag.upsert({
        where: { name: tag },
        update: {},
        create: {
          name: tag,
        },
      });
    }),
  );

  let slug = await replaceAuthorLinks(title, false);
  slug = slugify(slug);

  const event = await prisma.polkadotEvent.upsert({
    where: { id: message.id },
    create: {
      id: message.id,
      title: eventData.title!,
      description: eventData.description!,
      startsAt: eventData.startsAt,
      endsAt: eventData.endsAt,
      startDate: eventData.startsAt,
      endDate: eventData.endsAt,
      isAllDay: eventData.isAllDay,
      location: eventData.location,
      link: eventData.link,
      image: eventData.image,
      discordLink: eventData.discordLink,
      recurrencePattern: eventData.recurrenceRule,
      recurrenceEndDate: eventData.recurrenceEndDate,
      isPublished: false,
      userId: user.id,
      tags: {
        connect: tagInstances.map((tag) => ({ id: tag.id })),
      },
      embeds: {
        create: eventData.embeds.map((embed) => ({
          embedUrl: embed.url,
          embedImage: embed.imageUrl,
          width: embed.width,
          height: embed.height,
          embedColor: embed.color,
        })),
      },
    },
    update: {
      title: eventData.title!,
      description: eventData.description!,
      startsAt: eventData.startsAt,
      endsAt: eventData.endsAt,
      startDate: eventData.startsAt,
      endDate: eventData.endsAt,
      isAllDay: eventData.isAllDay,
      location: eventData.location,
      link: eventData.link,
      image: eventData.image,
      discordLink: eventData.discordLink,
      recurrencePattern: eventData.recurrenceRule,
      recurrenceEndDate: eventData.recurrenceEndDate,
      userId: user.id,
      embeds: {
        deleteMany: {},
        create: eventData.embeds.map((embed) => ({
          embedUrl: embed.url,
          embedImage: embed.imageUrl,
          width: embed.width,
          height: embed.height,
          embedColor: embed.color,
        })),
      },
      tags: {
        set: [], // Disconnect any existing tags
        connect: tagInstances.map((tag) => ({ id: tag.id })), // Connect new tags
      },
    },
    include: {
      embeds: true,
      tags: true,
      earnings: true,
    },
  });

  return event;
}

export async function getEvent(id: string): Promise<PolkadotEvent | null> {
  return prisma.polkadotEvent.findUnique({
    where: { id },
  });
}

export async function eventHasEarnings(eventId: string): Promise<boolean> {
  const earnings = await prisma.contentEarnings.findMany({
    where: { eventId },
  });

  return earnings.length > 0 && earnings[0].totalAmount > 0;
}

export async function flagDeleteEvent(eventId: string) {
  await prisma.polkadotEvent.update({
    where: { id: eventId },
    data: { isDeleted: true },
  });
}

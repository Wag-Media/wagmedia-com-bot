import { logger } from "@/client";
import { findOrCreatePost } from "@/data/post";
import { PostEmbed } from "@/types";
import { Embed, Message, PartialMessage } from "discord.js";

export async function handlePost(
  message: Message<boolean> | PartialMessage,
  messageLink: string
) {
  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedMessage = parseMessage(message.content!, message.embeds);

  if (!parsedMessage) {
    logger.error(`there was an error when parsing ${messageLink}`);
    return;
  }

  const { title, description, embeds, tags } = parsedMessage;

  const missingFields: string[] = [];

  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");
  if (!embeds || embeds.length === 0) missingFields.push("embeds");

  if (missingFields.length > 0) {
    logger.warn(
      `Post ${messageLink} is missing required fields: ${missingFields.join(
        ", "
      )}`
    );
    return;
  }

  // Check if the message contains necessary information
  logger.log(`New relevant message in the channel ${messageLink}`);
  logger.log(`↪ id: ${message.id}`);
  logger.log(`↪ user: ${message.member?.displayName}`);
  logger.log(`↪ title: ${title}`);
  logger.log(
    `↪ description: ${description!.substring(0, 30) + "..." || description}`
  );
  logger.log(`↪ embeds: ${embeds.length}`);
  logger.log(`↪ tags: ${tags}`);

  const post = findOrCreatePost({
    message,
    title: title!,
    description: description!,
    tags,
    embeds,
  });

  return post;
}

export function parseMessage(
  message: string,
  embeds: Embed[]
): {
  title: string | null;
  description: string | null;
  embeds: PostEmbed[];
  tags: string[];
} | null {
  try {
    // Regular expressions to match title, description, and tags (case-insensitive)
    const titleRegex = /title:\s*(.*?)\s*\n/i;
    // Modified descriptionRegex to make the lookahead for tags optional
    const descriptionRegex =
      /description:\s*([\s\S]*?)(?=\n(hashtags|tags):|$)/i;
    const tagsRegex = /(hashtags|tags):\s*([^\n]+)/i;

    // Extracting title, description, and tags using the regular expressions
    const titleMatch = message.match(titleRegex);
    const descriptionMatch = message.match(descriptionRegex);
    const tagsMatch = message.match(tagsRegex);

    const title = titleMatch ? titleMatch[1].trim() : null;
    const description = descriptionMatch ? descriptionMatch[1].trim() : null;
    let tags: string[] = [];

    // Process the hashtags string: split, remove leading '#', and filter empty strings
    if (tagsMatch) {
      // Normalize the tags string to remove '#' and split by non-word characters except for '-'
      tags = tagsMatch[2]
        .split(/[\s,]+/)
        .map((tag) => tag.replace(/^#/, "").trim())
        .filter((tag) => tag.length > 0);
    }

    let embedData = embeds.map((embed) => ({
      url: embed.url || null,
      imageUrl:
        embed.image?.proxyURL ||
        embed.image?.url ||
        embed.thumbnail?.url ||
        embed.thumbnail?.proxyURL ||
        null,
      color: embed.color || null,
    }));

    return { title, description, tags, embeds: embedData };
  } catch (error) {
    logger.error("Something went wrong when parsing the message:", error);
    return null;
  }
}

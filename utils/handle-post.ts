import { logger } from "@/client";
import { findOrCreatePost } from "@/data/post";
import { Embed, Message, PartialMessage } from "discord.js";

export async function handlePost(
  message: Message<boolean> | PartialMessage,
  messageLink: string
) {
  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedMessage = parseMessage(message.content!, message.embeds);

  if (!parsedMessage) {
    logger.error(`Post missing required fields in the channel ${messageLink}`);
    return;
  }

  const { title, description, embedUrl, embedImage, embedColor } =
    parsedMessage;
  const tags = parsedMessage.tags || [];

  // Check if the message contains necessary information
  logger.log(`New relevant message in the channel ${messageLink}`);
  logger.log(`↪ id: ${message.id}`);
  logger.log(`↪ user: ${message.member?.displayName}`);
  logger.log(`↪ title: ${title}`);
  logger.log(
    `↪ description: ${description.substring(0, 30) + "..." || description}`
  );
  logger.log(`↪ embedUrl: ${embedUrl}`);
  logger.log(`↪ embedImage: ${embedImage}`);
  logger.log(`↪ embedColor: ${embedColor}`);
  logger.log(`↪ tags: ${tags}`);

  const post = findOrCreatePost({
    message,
    title,
    description,
    tags,
    embedImageUrl: embedImage,
    contentUrl: embedUrl,
    embedColor,
  });
  //   message,
  //   title,
  //   description,
  //   tags,
  //   embedUrl,
  //   embedImage,
  //   embedColor
  // );

  return post;
}

export function parseMessage(
  message: string,
  embeds: Embed[]
): {
  title: string;
  description: string;
  embedUrl: string;
  embedImage: string | null;
  embedColor: number | null;
  tags: string[];
} | null {
  try {
    // Regular expressions to match title, description, and tags (case-insensitive)
    const titleRegex = /title:\s*(.*?)\s*\n/i;
    // Modified descriptionRegex to make the lookahead for tags optional
    const descriptionRegex =
      /description:\s*([\s\S]*?)(?=\n(hashtags|tags):|$)/i;
    const tagsRegex = /(hashtags|tags):\s*(#[\w-]+(?:[ ,]\s*#[\w-]+)*)/i;

    // Extracting title, description, and tags using the regular expressions
    const titleMatch = message.match(titleRegex);
    const descriptionMatch = message.match(descriptionRegex);
    const tagsMatch = message.match(tagsRegex);

    const title = titleMatch ? titleMatch[1].trim() : null;
    const description = descriptionMatch ? descriptionMatch[1].trim() : null;
    const tagsString = tagsMatch ? tagsMatch[2].trim() : "";

    // Process the hashtags string: split, remove leading '#', and filter empty strings
    const tags = tagsString
      .split(/[, ]+/)
      .map((tag) => tag.replace(/^#/, ""))
      .filter((tag) => tag.length > 0);

    // handle post embeds
    let embedUrl: string | null = null;
    let embedImage: string | null = null;
    let embedColor: number | null = null;

    if (embeds?.length > 0) {
      const embed = embeds[0]; // Assuming we take the first embed
      embedUrl = embed.url;
      embedImage =
        embed.image?.proxyURL ||
        embed.image?.url ||
        embed.thumbnail?.url ||
        embed.thumbnail?.proxyURL ||
        null;
      embedColor = embed.color;
    }

    if (!title || !description || !embedUrl) {
      return null;
    }

    return { title, description, tags, embedImage, embedUrl, embedColor };
  } catch (error) {
    logger.error("Something went wrong when parsing the message:", error);
    return null;
  }
}

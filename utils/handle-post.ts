import { logger } from "@/client";
import { findOrCreatePost } from "@/data/post";
import { PostEmbed, PostWithCategories } from "@/types";
import { Post } from "@prisma/client";
import { Embed, Message, PartialMessage } from "discord.js";

export type PostType = {
  title: string | null;
  description: string | null;
  embeds: PostEmbed[];
  tags: string[];
};

export async function handlePost(
  message: Message<boolean>,
  messageLink: string
): Promise<PostWithCategories | undefined> {
  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedMessage = parseMessage(message);

  if (!parsedMessage) {
    logger.error(`there was an error when parsing ${messageLink}`);
    return;
  }

  const { title, description, embeds, tags } = parsedMessage;
  // console.log(embeds);

  const missingFields: string[] = [];

  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");

  // Check if the message contains necessary information
  if (missingFields.length > 0) {
    logger.warn(
      `[post] Post is missing required fields: ${missingFields.join(
        ", "
      )}: ${messageLink}`
    );
    return;
  }

  logger.log(
    `[post] recorded new relevant message by ${
      message.member?.displayName
    } with ${embeds.length} ${embeds.length === 1 ? "embed" : "embeds"} and ${
      tags.length
    } ${
      tags.length === 1 ? "tag" : "tags"
    } in the channel ${messageLink}: ${title} `
  );

  const post = await findOrCreatePost({
    message,
    title: title!,
    description: description!,
    tags,
    embeds,
  });

  return post;
}

export function parseMessage(message: Message): PostType {
  const { content, embeds } = message;

  try {
    // Regular expressions to match title, description, and tags (case-insensitive)
    const titleRegex = /title:\s*(.*?)\s*\n/i;
    // Modified descriptionRegex to make the lookahead for tags optional
    const descriptionRegex =
      /description:\s*([\s\S]*?)(?=\n(hashtags|tags):|$)/i;
    const tagsRegex = /(hashtags|tags):\s*([^\n]+)/i;

    // Extracting title, description, and tags using the regular expressions
    const titleMatch = content.match(titleRegex);
    const descriptionMatch = content.match(descriptionRegex);
    const tagsMatch = content.match(tagsRegex);

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

    // console.log("embeds", embedData);

    return { title, description, tags, embeds: embedData };
  } catch (error) {
    logger.error("Something went wrong when parsing the message:", error);
    return { title: null, description: null, embeds: [], tags: [] };
  }
}

export function isPostValid(post: PostType): boolean {
  return !!post.title && !!post.description;
}

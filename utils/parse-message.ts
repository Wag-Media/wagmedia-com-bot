import { logger } from "@/client";
import { Embed } from "discord.js";

export function parseMessage(
  message: string,
  embeds: Embed[]
): {
  title: string | null;
  description: string | null;
  embedUrl: string | null;
  embedImage: string | null;
  tags: string[] | null;
} {
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
    if (embeds?.length > 0) {
      const embed = embeds[0]; // Assuming we take the first embed
      console.log(embed.thumbnail);
      embedUrl = embed.url;
      embedImage = embed.thumbnail?.url || embed.thumbnail?.proxyURL || null;
    }

    return { title, description, tags, embedImage, embedUrl };
  } catch (error) {
    logger.error("Something went wrong when parsing the message:", error);
    return {
      title: null,
      description: null,
      tags: null,
      embedImage: null,
      embedUrl: null,
    };
  }
}

// Odd-Job Role:
// Odd-Job Description:
// Odd-Job Timeline:
// Agreed Payment:
// Managing Director:
export function parseOddjob(message: string): {
  role: string | null;
  description: string | null;
  timeline: string | null;
  payment: string | null;
  manager: string | null;
} {
  return {
    role: null,
    description: null,
    timeline: null,
    payment: null,
    manager: null,
  };
}

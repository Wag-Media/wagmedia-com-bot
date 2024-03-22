import { PostWithCategoriesEarnings } from "@/types";
import { Message } from "discord.js";
import { handlePost, parseMessage } from "./handle-post";
import { prisma } from "./prisma";
import { Category } from "@prisma/client";
import { addCategory, findOrCreatePost } from "@/data/post";
import { logger } from "@/client";
import * as config from "@/config";

export async function handleNewsletter(
  message: Message<boolean>,
  messageLink: string,
): Promise<PostWithCategoriesEarnings | undefined> {
  // 1. parse the message like we do for posts
  const parsedMessage = parseMessage(message);

  if (!parsedMessage) {
    logger.error(`there was an error when parsing ${messageLink}`);
    return;
  }

  const { title, description, embeds, tags } = parsedMessage;

  const missingFields: string[] = [];

  if (!title) missingFields.push("title");
  if (!description) missingFields.push("description");

  // Check if the message contains necessary information
  if (missingFields.length > 0) {
    logger.warn(
      `[newsletter] Newsletter ${messageLink} is missing required fields: ${missingFields.join(
        ", ",
      )}`,
    );
    return;
  }

  logger.log(
    `[newsletter] New valid post by ${message.member?.displayName} with ${
      embeds.length
    } ${embeds.length === 1 ? "embed" : "embeds"} and ${tags.length} ${
      tags.length === 1 ? "tag" : "tags"
    } in the channel ${messageLink}: ${title} `,
  );

  const post = await findOrCreatePost({
    message,
    title: title!,
    description: description!,
    tags,
    embeds,
  });

  if (!post) {
    return;
  }

  // 2. handle the newsletter specific logic, i.e. add the newsletter category
  const newsletterCategory = await getNewsletterCategory();

  // 3. add the newsletter category to the post
  await addCategory(post.id, newsletterCategory.id);

  return post;
}

export async function getNewsletterCategory(): Promise<Category> {
  const newsletterEmoji = await prisma.emoji.upsert({
    where: {
      id: config.NEWSLETTER_CATEGORY_NAME,
    },
    update: {},
    create: {
      id: config.NEWSLETTER_CATEGORY_NAME,
      name: config.NEWSLETTER_CATEGORY_NAME,
    },
  });

  const newsletterCategory = await prisma.category.upsert({
    where: {
      name: config.NEWSLETTER_CATEGORY_NAME,
    },
    update: {
      name: config.NEWSLETTER_CATEGORY_NAME,
    },
    create: {
      name: config.NEWSLETTER_CATEGORY_NAME,
      emojiId: newsletterEmoji.id,
    },
  });

  return newsletterCategory;
}

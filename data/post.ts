import {
  Category,
  ContentEarnings,
  Embed,
  Post,
  PrismaClient,
  Tag,
} from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "./user.js";
import { logger } from "@/client.js";
import { slugify } from "@/handlers/util.js";
import { PostEmbed } from "@/types.js";
const prisma = new PrismaClient();

export type PostCreateType = {
  message: Message<boolean> | PartialMessage;
  title: string;
  description: string;
  tags: string[];
  embeds: PostEmbed[];
  parentId?: string;
};

export const findOrCreatePost = async (
  attributes: PostCreateType
): Promise<
  Post & { categories: Category[] } & { tags: Tag[] } & { embeds: Embed[] }
> => {
  const { message, title, description, tags, embeds } = attributes;

  if (!message) {
    throw new Error("Message must be defined");
  }
  if (!message.id) {
    throw new Error("Message must have an id");
  }
  if (!message.content) {
    throw new Error("Message must have content");
  }

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  const user = await findOrCreateUser(message);

  // Ensure all tags exist
  const tagInstances = await Promise.all(
    tags.map(async (tag) => {
      return prisma.tag.upsert({
        where: { name: tag },
        update: {},
        create: {
          name: tag,
        },
      });
    })
  );

  // Upsert the post
  const post = await prisma.post.upsert({
    where: { id: message.id },
    update: {
      title,
      content: description,
      discordLink: messageLink,
      slug: slugify(title),
      isDeleted: false,
      // Update tags connection
      tags: {
        set: [], // Disconnect any existing tags
        connect: tagInstances.map((tag) => ({ id: tag.id })), // Connect new tags
      },
    },
    create: {
      id: message.id,
      title,
      content: description,
      discordLink: messageLink,
      slug: slugify(title),
      userId: user.id, // Assuming you have the user's ID
      tags: {
        connect: tagInstances.map((tag) => ({ id: tag.id })),
      },
      embeds: {
        create: embeds.map((embed) => ({
          embedUrl: embed.url,
          embedImage: embed.imageUrl,
          embedColor: embed.color,
        })),
      },
    },
    include: {
      categories: true,
      tags: true, // Include tags in the returned object for verification
      embeds: true,
    },
  });

  return post;
};

/**
 * Threads are just posts with a parentId
 * @param message
 * @param content
 * @param url
 * @returns
 */
export async function findOrCreateThreadPost(attributes: {
  message: Message<boolean> | PartialMessage;
  content: string;
  url: string;
}): Promise<Post & { categories: Category[] & Tag[] }> {
  const { message, content, url } = attributes;
  const threadPost = findOrCreatePost({
    message,
    title: "Thread",
    description: content,
    tags: [],
    embeds: [],
    parentId: message.channel.id,
  });
  return threadPost;
}

export async function fetchPost(
  reaction: MessageReaction
): Promise<
  (Post & { categories: Category[] } & { earnings: ContentEarnings[] }) | null
> {
  if (!reaction.message.id) {
    throw new Error("Message must have an id");
  }
  if (!reaction.message.content) {
    throw new Error("Message must have content");
  }

  const post = await prisma.post.findUnique({
    where: { id: reaction.message.id },
    include: { categories: true, earnings: true },
  });

  if (!post) {
    logger.warn(
      `Post with ID ${reaction.message.id} not found in the database.`
    );
  }
  return post;
}

export async function removeCategoryFromPost(
  postId: string,
  categoryId: number
) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      categories: {
        disconnect: [{ id: categoryId }],
      },
    },
  });

  return post;
}

export async function removeReactionFromPost(
  postId: string,
  userId: string,
  emojiId: string
) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      reactions: {
        delete: {
          postId_userDiscordId_emojiId: {
            postId,
            emojiId,
            userDiscordId: userId,
          },
        },
      },
    },
  });

  return post;
}

export async function unpublishPost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isPublished: false,
    },
  });

  return post;
}

export async function flagDeletePost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isDeleted: true,
    },
  });

  return post;
}

export async function getPost(postId: string) {
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
  });

  return post;
}

import {
  Category,
  Post,
  PostEarnings,
  PrismaClient,
  Tag,
} from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "./user.js";
import { parseMessage } from "@/utils/parse-message.js";
import { logger } from "@/client.js";
const prisma = new PrismaClient();

export const findOrCreatePost = async (
  message: Message<boolean> | PartialMessage
): Promise<Post & { categories: Category[] & Tag[] }> => {
  if (!message.id) {
    throw new Error("Message must have an id");
  }
  if (!message.content) {
    throw new Error("Message must have content");
  }

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  const { title, description, tags } = parseMessage(message.content);
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
      link: messageLink,
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
      link: messageLink,
      userId: user.id, // Assuming you have the user's ID
      tags: {
        connect: tagInstances.map((tag) => ({ id: tag.id })),
      },
    },
    include: {
      categories: true,
      tags: true, // Include tags in the returned object for verification
    },
  });

  return post;
};

export async function fetchPost(
  reaction: MessageReaction
): Promise<
  (Post & { categories: Category[] } & { earnings: PostEarnings[] }) | null
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

import { Category, Post, PrismaClient } from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "./user.js";
import { parseMessage } from "@/utils/parse-message.js";
import { logger } from "@/client.js";
const prisma = new PrismaClient();

export const findOrCreatePost = async (
  message: Message<boolean> | PartialMessage
): Promise<Post & { categories: Category[] }> => {
  if (!message.id) {
    throw new Error("Message must have an id");
  }
  if (!message.content) {
    throw new Error("Message must have content");
  }

  const { title, description, tags } = parseMessage(message.content);
  const user = await findOrCreateUser(message);

  const post = await prisma.post.upsert({
    where: {
      id: message.id,
    },
    include: {
      categories: true, // Include the categories in the result
    },
    update: {},
    create: {
      id: message.id,
      title,
      content: description,
      userId: user.id, // use the discordId from the upserted user
    },
  });

  return post;
};

export async function fetchPost(
  reaction: MessageReaction
): Promise<(Post & { categories: Category[] }) | null> {
  if (!reaction.message.id) {
    throw new Error("Message must have an id");
  }
  if (!reaction.message.content) {
    throw new Error("Message must have content");
  }

  const post = await prisma.post.findUnique({
    where: { id: reaction.message.id },
    include: { categories: true },
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

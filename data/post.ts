import { Category, Post, PrismaClient } from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "./user.js";
import { parseMessage } from "@/utils/parse-message.js";
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

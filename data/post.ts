import { Post, PrismaClient } from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "./user.js";
import { parseMessage } from "@/utils/parse-message.js";
const prisma = new PrismaClient();

export const findOrCreatePost = async (
  message: Message<boolean> | PartialMessage
): Promise<Post> => {
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
    update: {},
    create: {
      id: message.id,
      title,
      content: description,
      userId: user.id, // use the discordId from the upserted user
      published: false,
      // TODO Include logic to add categories and hashtags if applicable
    },
  });

  return post;
};
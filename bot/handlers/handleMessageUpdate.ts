import { parseMessage } from "@/utils/parse-message";
import * as config from "../config";
import { findOrCreateUser } from "@/data/user";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/client";
import { ensureFullMessage, shouldIgnoreMessage } from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost } from "@/data/post";

export async function handleMessageUpdate(
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  logger.log(`(edited) new relevant message in the channel`);
  if (shouldIgnoreMessage(newMessage, newMessage.author)) return;

  newMessage = await ensureFullMessage(newMessage);

  const messageLink = `https://discord.com/channels/${newMessage.guild?.id}/${newMessage.channel.id}/${newMessage.id}`;
  const { title, description, tags } = parseMessage(newMessage.content!);

  // Check if the message contains necessary information
  if (title && description) {
    logger.log(`(edited) new relevant message in the channel ${messageLink}`);
    logger.log(`↪ user: ${newMessage.member?.displayName}`);
    logger.log(`↪ title: ${title}`);
    logger.log(`↪ description: ${description}`);
    logger.log(`↪ tags: ${tags}`);

    const post = findOrCreatePost(newMessage);
  }
}

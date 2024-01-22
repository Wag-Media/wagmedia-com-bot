import { parseMessage } from "@/utils/parse-message";
import * as config from "../config";
import { findOrCreateUser } from "@/data/user";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/client";
import { ensureFullMessage, shouldIgnoreMessage } from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost } from "@/data/post";

const prisma = new PrismaClient();

export async function handleMessageCreate(
  message: Message<boolean> | PartialMessage
) {
  if (shouldIgnoreMessage(message)) return;

  message = await ensureFullMessage(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;
  const { title, description, tags } = parseMessage(message.content!);

  // Check if the message contains necessary information
  if (title && description) {
    logger.log(`New relevant message in the channel ${messageLink}`);
    logger.log(`↪ user: ${message.member?.displayName}`);
    logger.log(`↪ title: ${title}`);
    logger.log(`↪ description: ${description}`);
    logger.log(`↪ tags: ${tags}`);
    const post = findOrCreatePost(message);
  }
}

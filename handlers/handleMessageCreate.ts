import { parseMessage } from "@/utils/parse-message";
import * as config from "../config";
import { findOrCreateUser } from "@/data/user";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/client";
import { ensureFullMessage, shouldIgnoreMessage } from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost } from "@/data/post";

export async function handleMessageCreate(
  message: Message<boolean> | PartialMessage
) {
  if (shouldIgnoreMessage(message, message.author)) return;

  message = await ensureFullMessage(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedMessage = parseMessage(message.content!, message.embeds);
  const { title, description, embedUrl, embedImage } = parsedMessage;
  const tags = parsedMessage.tags || [];

  // Check if the message contains necessary information
  if (title && description && embedUrl) {
    logger.log(`New relevant message in the channel ${messageLink}`);
    logger.log(`↪ user: ${message.member?.displayName}`);
    logger.log(`↪ title: ${title}`);
    logger.log(`↪ description: ${description}`);
    logger.log(`↪ embedUrl: ${embedUrl}`);
    logger.log(`↪ tags: ${tags}`);
    const post = findOrCreatePost(
      message,
      title,
      description,
      tags,
      embedUrl,
      embedImage
    );
  }
}

import { parseMessage } from "@/utils/parse-message";
import { logger } from "@/client";
import {
  ensureFullMessage,
  isMessageFromOddJobsChannel,
  shouldIgnoreMessage,
} from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost } from "@/data/post";
import { parseOddjob } from "@/utils/parse-oddjob";
import { findOrCreateOddJob } from "@/data/oddjob";

export async function handleMessageCreate(
  message: Message<boolean> | PartialMessage
) {
  if (shouldIgnoreMessage(message, message.author)) return;

  message = await ensureFullMessage(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  if (isMessageFromOddJobsChannel(message.channel)) {
    // content is not null because we checked for it in shouldIgnoreMessage
    const { description, manager, payment, role, timeline } = parseOddjob(
      message.content!
    );

    logger.log(`New odd job in the channel ${messageLink}`);
    logger.log(`↪ id: ${message.id}`);
    logger.log(`↪ role: ${role}`);
    logger.log(`↪ description: ${description}`);
    logger.log(`↪ timeline: ${timeline}`);
    logger.log(`↪ payment: ${payment?.amount} ${payment?.unit}`);
    logger.log(`↪ manager: ${manager}`);

    if (
      !role ||
      !description ||
      !timeline ||
      !payment ||
      !payment.amount ||
      !payment.unit ||
      !manager
    ) {
      logger.error(
        `Odd job missing required fields in the channel ${messageLink}`
      );
      return;
    }

    const oddjob = findOrCreateOddJob(
      message,
      messageLink,
      role,
      description,
      timeline,
      payment?.amount,
      payment?.unit,
      manager
    );
  } else {
    // content is not null because we checked for it in shouldIgnoreMessage
    const parsedMessage = parseMessage(message.content!, message.embeds);
    const { title, description, embedUrl, embedImage, embedColor } =
      parsedMessage;
    const tags = parsedMessage.tags || [];

    // Check if the message contains necessary information
    if (title && description && embedUrl) {
      logger.log(`New relevant message in the channel ${messageLink}`);
      logger.log(`↪ id: ${message.id}`);
      logger.log(`↪ user: ${message.member?.displayName}`);
      logger.log(`↪ title: ${title}`);
      logger.log(`↪ description: ${description}`);
      logger.log(`↪ embedUrl: ${embedUrl}`);
      logger.log(`↪ embedImage: ${embedImage}`);
      logger.log(`↪ embedColor: ${embedColor}`);
      logger.log(`↪ tags: ${tags}`);
      const post = findOrCreatePost(
        message,
        title,
        description,
        tags,
        embedUrl,
        embedImage,
        embedColor
      );
    }
  }
}

import { logger } from "@/client";
import {
  ensureFullMessage,
  isMessageFromOddJobsChannel,
  shouldIgnoreMessage,
} from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost } from "@/data/post";
import { handleOddJob } from "../utils/handle-odd-job";
import { handlePost } from "../utils/handle-post";

export async function handleMessageUpdate(
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage
) {
  logger.log(`(edited) new relevant message in the channel`);
  newMessage = await ensureFullMessage(newMessage);
  if (shouldIgnoreMessage(newMessage, newMessage.author)) return;

  const messageLink = `https://discord.com/channels/${newMessage.guild?.id}/${newMessage.channel.id}/${newMessage.id}`;

  if (isMessageFromOddJobsChannel(newMessage.channel)) {
    oldMessage = await ensureFullMessage(oldMessage);
    const oldOddJob = await handleOddJob(oldMessage, messageLink);
    const newOddJob = await handleOddJob(newMessage, messageLink);

    if (oldOddJob && newOddJob) {
      logger.log(`Odd job updated in the channel ${messageLink}`);
    } else if (oldOddJob && !newOddJob) {
      logger.log(
        `Odd job invalid in the channel ${messageLink}. Not updating.`
      );
      newMessage.author.send(
        `Your odd job in ${messageLink} is invalid and is not being updated. Please correct it.`
      );
    } else if (!oldOddJob && newOddJob) {
      logger.log(
        `Oddjob is now valid and added to the db / updated: ${messageLink}`
      );
    }
  } else {
    await handlePost(newMessage, messageLink);
  }
}

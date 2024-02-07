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
import { handlePost } from "../utils/handle-post";
import { _handleOddJob, handleOddJob } from "../utils/handle-odd-job";

export async function handleMessageCreate(
  message: Message<boolean> | PartialMessage
) {
  if (shouldIgnoreMessage(message, message.author)) return;

  message = await ensureFullMessage(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  if (isMessageFromOddJobsChannel(message.channel)) {
    handleOddJob(message, messageLink);
  } else {
    handlePost(message, messageLink);
  }
}

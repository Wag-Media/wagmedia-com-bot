import {
  ensureFullMessage,
  isMessageFromOddJobsChannel,
  shouldIgnoreMessage,
} from "./util";
import { Message, PartialMessage } from "discord.js";
import { handlePost } from "../utils/handle-post";
import { handleOddJob } from "../utils/handle-odd-job";

export async function handleMessageCreate(
  message: Message<boolean> | PartialMessage
) {
  if (message.partial) {
    console.log("Message is partial");
  }

  if (shouldIgnoreMessage(message, message.author)) return;

  message = await ensureFullMessage(message);

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  if (isMessageFromOddJobsChannel(message.channel)) {
    handleOddJob(message, messageLink);
  } else {
    handlePost(message, messageLink);
  }
}

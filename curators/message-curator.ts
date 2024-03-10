import {
  classifyMessage,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForPosts,
  isParentMessageFromMonitoredCategoryOrChannel,
  shouldIgnoreMessage,
} from "@/handlers/util";
import { PostWithCategories } from "@/types";
import { handleOddJob } from "@/utils/handle-odd-job";
import { PostType, handlePost } from "@/utils/handle-post";
import { OddJob, Post } from "@prisma/client";
import { Channel, Message } from "discord.js";

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class MessageCurator {
  messageChannelType: "post" | "oddjob" | undefined;

  static async curate(
    message: Message,
    wasPartial: boolean
  ): Promise<PostWithCategories | OddJob | undefined> {
    if (shouldIgnoreMessage(message)) {
      return;
    }

    const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

    const classifiedMessage = classifyMessage(message);
    const messageChannelType = classifiedMessage.messageChannelType;

    if (messageChannelType === "post") {
      return await handlePost(message, messageLink);
    } else if (messageChannelType === "oddjob") {
      return await handleOddJob(message, messageLink);
    }
  }
}

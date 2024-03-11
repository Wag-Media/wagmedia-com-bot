import { logger } from "@/client";
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
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static parentId: string | undefined;
  private static messageLink: string;

  static async curate(
    message: Message,
    wasPartial: boolean
  ): Promise<PostWithCategories | OddJob | undefined> {
    if (shouldIgnoreMessage(message)) {
      return;
    }

    this.messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

    const classifiedMessage = classifyMessage(message);
    this.messageChannelType = classifiedMessage.messageChannelType;
    this.parentId = classifiedMessage.parentId;

    if (this.messageChannelType === "post" && !this.parentId) {
      return await handlePost(message, this.messageLink);
    } else if (this.messageChannelType === "oddjob") {
      return await handleOddJob(message, this.messageLink);
    } else if (this.messageChannelType === "post" && this.parentId) {
      // skip thread messages, they will only be added to the db after they received an emoji
      // check the reaction curator
      logger.info(
        `[post] Thread message detected: ${this.messageLink}, skipping`
      );
    } else {
      logger.error(
        `[post] Message type not recognized: ${this.messageLink}, skipping`
      );
    }
  }
}

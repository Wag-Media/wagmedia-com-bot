import { logger } from "@/client";
import { findOrCreatePost, flagDeletePost, getPost } from "@/data/post";
import {
  classifyMessage,
  ensureFullMessage,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForPosts,
  isParentMessageFromMonitoredCategoryOrChannel,
  shouldIgnoreMessage,
} from "@/handlers/util";
import {
  OddjobWithEarnings,
  PostWithCategories,
  PostWithCategoriesEarnings,
} from "@/types";
import { handleOddJob, parseOddjob } from "@/utils/handle-odd-job";
import {
  PostType,
  handlePost,
  isPostValid,
  parseMessage,
} from "@/utils/handle-post";
import { OddJob, Post } from "@prisma/client";
import { Channel, Message, PartialMessage } from "discord.js";

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class MessageCurator {
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static parentId: string | undefined;
  private static messageLink: string;

  static async curate(
    message: Message
  ): Promise<PostWithCategoriesEarnings | OddjobWithEarnings | undefined> {
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
      // the message is not from a monitored channel or category
      return;
    }
  }

  public static async curateUpdate(
    oldMessage: Message,
    newMessage: Message | PartialMessage
  ): Promise<PostWithCategories | OddJob | undefined> {
    const { message: newFullMessage } = await ensureFullMessage(newMessage);
    if (shouldIgnoreMessage(newFullMessage)) {
      return;
    }

    this.messageLink = `https://discord.com/channels/${newFullMessage.guild?.id}/${newFullMessage.channel.id}/${newFullMessage.id}`;

    const oldClassifiedMessage = classifyMessage(oldMessage);
    this.messageChannelType = oldClassifiedMessage.messageChannelType;
    this.parentId = oldClassifiedMessage.parentId;

    // 1. post updates
    if (this.messageChannelType === "post" && !this.parentId) {
      const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
      const oldPost = await parseMessage(oldFullMessage);
      const newPost = await parseMessage(newFullMessage);

      const oldPostValid = isPostValid(oldPost);
      const newPostValid = isPostValid(newPost);

      const oldDbPost = await getPost(oldFullMessage.id);
      if (oldDbPost) {
        logger.log(`[post] (edited) new relevant message in the channel`);
      }

      if (oldDbPost?.isPublished) {
        logger.logAndSend(
          `The post ${this.messageLink} is already published and cannot be edited. If you want to change it, unpublish it first.`,
          newFullMessage.author
        );
      } else if (oldPostValid && newPostValid) {
        await findOrCreatePost({
          message: newFullMessage,
          title: newPost.title!,
          description: newPost.description!,
          tags: newPost.tags,
          embeds: newPost.embeds,
        });
        logger.log(`[post] Post updated: ${this.messageLink}`);
      } else if (oldPostValid && !newPostValid) {
        await flagDeletePost(newFullMessage.id);
        logger.logAndSend(
          `Your post in ${this.messageLink} is invalid and is unpublished until it is corrected.`,
          newFullMessage.author
        );
      } else if (!oldPostValid && newPostValid) {
        await findOrCreatePost({
          message: newFullMessage,
          title: newPost.title!,
          description: newPost.description!,
          tags: newPost.tags,
          embeds: newPost.embeds,
        });
        logger.log(
          `Post is now valid and added to the db / updated: ${this.messageLink}`
        );
      } else if (!oldPostValid && !newPostValid) {
        return;
      }

      // 2. odd job updates
    } else if (this.messageChannelType === "oddjob") {
      const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
      const oldOddJob = await parseOddjob(
        oldFullMessage.content,
        oldFullMessage.mentions,
        oldFullMessage.attachments
      );
      const newOddJob = await parseOddjob(
        newFullMessage.content,
        newFullMessage.mentions,
        newFullMessage.attachments
      );

      if (oldOddJob && newOddJob) {
        logger.log(`Odd job updated in the channel ${this.messageLink}`);
      } else if (oldOddJob && !newOddJob) {
        logger.log(
          `Odd job invalid in the channel ${this.messageLink}. Not updating.`
        );
        newFullMessage.author.send(
          `Your odd job in ${this.messageLink} is invalid and is not being updated in the database. Please correct it.`
        );
      } else if (!oldOddJob && newOddJob) {
        logger.log(
          `Oddjob is now valid and added to the db / updated: ${this.messageLink}`
        );
      }

      // 3. thread message updates
    } else if (this.messageChannelType === "post" && this.parentId) {
      // skip thread messages content is not relevant here
      logger.info(
        `[post] Thread message detected: ${this.messageLink}, skipping update`
      );

      // 4. the message is not from a monitored channel or category
    } else {
      return;
    }
  }

  public static async curateDelete(
    message: Message | PartialMessage
  ): Promise<void> {
    const { message: fullMessage } = await ensureFullMessage(message);
    if (shouldIgnoreMessage(fullMessage)) {
      return;
    }

    const post = await getPost(fullMessage.id);
    if (post) {
      if (post.isPublished) {
        logger.logAndSend(
          `🚨 The post ${this.messageLink} has been deleted. The post has been unpublished.`,
          fullMessage.author
        );
      } else {
        logger.log(`[post] Post deleted: ${this.messageLink}`);
      }
    } else {
      logger.log(`[post] Message deleted: ${this.messageLink}`);
    }
  }
}

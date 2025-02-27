import { logger } from "@/client";
import { findOrCreateOddJob, oddJobHasEarnings } from "@/data/oddjob";
import {
  findOrCreatePost,
  flagDeletePost,
  getPost,
  getPostWithEarnings,
} from "@/data/post";
import { ensureFullMessage, shouldIgnoreMessage } from "@/handlers/util";
import {
  ContentType,
  OddjobWithEarnings,
  PolkadotEventWithTagsEmbeds,
  PostWithCategories,
  PostWithCategoriesEarnings,
} from "@/types";
import {
  handleOddJob,
  isOddJobValid,
  parseOddjob,
} from "@/utils/handle-odd-job";
import { handlePost, isPostValid, parseMessage } from "@/utils/handle-post";
import { handleEvent, isEventValid } from "@/utils/handle-event";
import { prisma } from "@/utils/prisma";
import { OddJob } from "@prisma/client";
import { Message, PartialMessage } from "discord.js";
import { determineContentType } from "./utils";
import { handleNewsletter } from "@/utils/handle-newsletter";
import { findOrCreateEvent, flagDeleteEvent, getEvent } from "@/data/event";
import { parseEventFromDiscord } from "@/utils/parse-event";

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class MessageCurator {
  private static messageChannelType: ContentType;
  private static parentId: string | undefined;
  private static messageLink: string;

  static async curate(
    message: Message,
  ): Promise<
    | PostWithCategoriesEarnings
    | OddjobWithEarnings
    | PolkadotEventWithTagsEmbeds
    | undefined
  > {
    if (shouldIgnoreMessage(message)) {
      return;
    }

    this.messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

    const classifiedMessage = determineContentType(message);
    this.messageChannelType = classifiedMessage.contentType;
    this.parentId = classifiedMessage.parentId;

    if (this.messageChannelType === "post" && !this.parentId) {
      return await handlePost(message, this.messageLink);
    } else if (this.messageChannelType === "oddjob") {
      return await handleOddJob(message, this.messageLink);
    } else if (this.messageChannelType === "post" && this.parentId) {
      // skip thread messages, they will only be added to the db after they received an emoji
      // check the reaction curator
    } else if (this.messageChannelType === "newsletter") {
      return await handleNewsletter(message, this.messageLink);
    } else if (this.messageChannelType === "event") {
      return await handleEvent(message, this.messageLink);
    } else {
      // the message is not from a monitored channel or category
      return;
    }
  }

  public static async curateUpdate(
    oldMessage: Message,
    newMessage: Message | PartialMessage,
  ): Promise<PostWithCategories | OddJob | undefined> {
    const { message: newFullMessage } = await ensureFullMessage(newMessage);
    if (shouldIgnoreMessage(newFullMessage)) {
      return;
    }

    this.messageLink = `https://discord.com/channels/${newFullMessage.guild?.id}/${newFullMessage.channel.id}/${newFullMessage.id}`;

    const oldClassifiedMessage = determineContentType(oldMessage);
    this.messageChannelType = oldClassifiedMessage.contentType;
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
          newFullMessage.author,
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
          newFullMessage.author,
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
          `Post is now valid and added to the db / updated: ${this.messageLink}`,
        );
      } else if (!oldPostValid && !newPostValid) {
        return;
      }

      // 2. odd job updates
    } else if (this.messageChannelType === "oddjob") {
      const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
      const oldOddJob = await parseOddjob(oldFullMessage);
      const newOddJob = await parseOddjob(newFullMessage);

      const oldOddJobValid = isOddJobValid(oldOddJob);
      const newOddJobValid = isOddJobValid(newOddJob);

      const oldOddJobHasEarnings = await oddJobHasEarnings(oldFullMessage.id);

      console.warn("oldOddJobHasEarnings", oldOddJobHasEarnings);

      if (oldOddJobHasEarnings) {
        logger.logAndSend(
          `The oddjob ${this.messageLink} is already paid and cannot be edited.`,
          newFullMessage.author,
        );
        return;
      }

      if (oldOddJobValid && newOddJobValid) {
        await findOrCreateOddJob(
          newFullMessage,
          this.messageLink,
          newOddJob.role!,
          newOddJob.description!,
          newOddJob.timeline!,
          newOddJob.payment?.amount!,
          newOddJob.payment?.unit!,
          newOddJob.manager!,
        );
        logger.log(`[oddjob] Odd job ${this.messageLink} updated`);
      } else if (oldOddJobValid && !newOddJobValid) {
        logger.logAndSend(
          `Odd job ${this.messageLink} is invalid and not updated in the database. Please correct it.`,
          newFullMessage.author,
        );
      } else if (!oldOddJobValid && newOddJobValid) {
        await findOrCreateOddJob(
          newFullMessage,
          this.messageLink,
          newOddJob.role!,
          newOddJob.description!,
          newOddJob.timeline!,
          newOddJob.payment?.amount!,
          newOddJob.payment?.unit!,
          newOddJob.manager!,
        );
        logger.log(
          `Oddjob is now valid and added to the db / updated: ${this.messageLink}`,
        );
      }

      // 3. thread message updates
    } else if (this.messageChannelType === "post" && this.parentId) {
      // skip thread messages content is not relevant here
      logger.info(
        `[post] Thread message detected: ${this.messageLink}, skipping update`,
      );

      // 4. the message is not from a monitored channel or category
    } else if (this.messageChannelType === "event") {
      const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
      const oldEvent = await parseEventFromDiscord(oldFullMessage);
      const newEvent = await parseEventFromDiscord(newFullMessage);

      const oldEventValid = isEventValid(oldEvent);
      const newEventValid = isEventValid(newEvent);

      console.log("oldEventValid", oldEventValid);
      console.log("newEventValid", newEventValid);

      const oldDbEvent = await getEvent(oldFullMessage.id);
      if (oldDbEvent) {
        logger.log(`[event] Event updated: ${this.messageLink}`);
      }

      if (oldDbEvent?.isPublished) {
        logger.logAndSend(
          `The event ${this.messageLink} is already published and cannot be edited. If you want to change it, unpublish it first.`,
          newFullMessage.author,
        );
      } else if (oldEventValid && newEventValid) {
        await findOrCreateEvent({ message: newFullMessage, ...newEvent });
        logger.log(`[event] Event updated: ${this.messageLink}`);
      } else if (oldEventValid && !newEventValid) {
        await flagDeleteEvent(newFullMessage.id);
        logger.logAndSend(
          `Your event in ${this.messageLink} is invalid and is unpublished until it is corrected.`,
          newFullMessage.author,
        );
      } else if (!oldEventValid && newEventValid) {
        await findOrCreateEvent({ message: newFullMessage, ...newEvent });
        logger.log(
          `Event is now valid and added to the db / updated: ${this.messageLink}`,
        );
      } else if (!oldEventValid && !newEventValid) {
        return;
      }
    } else {
      return;
    }
  }

  public static async curateDelete(
    message: Message | PartialMessage,
  ): Promise<void> {
    if (shouldIgnoreMessage(message)) {
      return;
    }

    const { contentType } = determineContentType(message);

    const channelLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}`;

    if (contentType === "post" || contentType === "thread") {
      const post = await getPostWithEarnings(message.id);
      if (post) {
        const postHasEarnings = post.earnings.length > 0;

        if (postHasEarnings) {
          logger.warn(
            `[${contentType}] A paid ${contentType}${contentType === "thread" && " comment"} was deleted in ${channelLink}`,
          );
          message.author &&
            message.author.send(
              `Uh oh, your paid ${contentType} in ${channelLink} was just deleted. Please contact a moderator if you think this was a mistake.`,
            );
          await prisma.post.update({
            where: { id: message.id },
            data: { isDeleted: true },
          });
        } else {
          logger.log(
            `[${contentType}] A ${contentType} that was not yet paid was deleted in ${channelLink}`,
          );
          await prisma.post.delete({ where: { id: message.id } });
        }

        return;
      }
    }

    const oddJob = await prisma.oddJob.findUnique({
      where: { id: message.id },
      include: { payments: true },
    });

    if (oddJob) {
      if (oddJob.payments.length > 0) {
        logger.warn(`[oddjob] A paid oddJob was deleted in ${channelLink}`);
        message.author &&
          message.author.send(
            `Uh oh, your paid odd job in ${channelLink} was just deleted. Please contact a moderator if you think this was a mistake.`,
          );
        await prisma.oddJob.update({
          where: { id: message.id },
          data: { isDeleted: true },
        });
      } else {
        logger.log(
          `[oddjob] An oddjob that was not yet published was deleted in ${channelLink}`,
        );
        await prisma.oddJob.delete({ where: { id: message.id } });
      }
    }
  }
}

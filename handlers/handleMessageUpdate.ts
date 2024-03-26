import { logger } from "@/client";
import {
  ensureFullMessage,
  isChannelMonitoredForOddJobs,
  shouldIgnoreMessage,
} from "./util";
import { Message, PartialMessage } from "discord.js";
import { findOrCreatePost, flagDeletePost, getPost } from "@/data/post";
import { handleOddJob } from "../utils/handle-odd-job";
import { isPostValid, parseMessage } from "../utils/handle-post";

export async function handleMessageUpdate(
  oldMessage: Message<boolean> | PartialMessage,
  newMessage: Message<boolean> | PartialMessage,
) {
  const { message: newFullMessage } = await ensureFullMessage(newMessage);
  if (shouldIgnoreMessage(newFullMessage)) return;

  const messageLink = `https://discord.com/channels/${newFullMessage.guild?.id}/${newFullMessage.channel.id}/${newFullMessage.id}`;

  if (isChannelMonitoredForOddJobs(newFullMessage.channel)) {
    const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
    const oldOddJob = await handleOddJob(oldFullMessage, messageLink);
    const newOddJob = await handleOddJob(newFullMessage, messageLink);

    if (oldOddJob && newOddJob) {
      logger.log(`Odd job updated in the channel ${messageLink}`);
    } else if (oldOddJob && !newOddJob) {
      logger.log(
        `Odd job invalid in the channel ${messageLink}. Not updating.`,
      );
      newFullMessage.author.send(
        `Your odd job in ${messageLink} is invalid and is not being updated in the database. Please correct it.`,
      );
    } else if (!oldOddJob && newOddJob) {
      logger.log(
        `Oddjob is now valid and added to the db / updated: ${messageLink}`,
      );
    }
  } else {
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
        `The post ${messageLink} is already published and cannot be edited. If you want to change it, unpublish it first.`,
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
      logger.log(`[post] Post updated: ${messageLink}`);
    } else if (oldPostValid && !newPostValid) {
      await flagDeletePost(newFullMessage.id);
      logger.logAndSend(
        `Your post in ${messageLink} is invalid and is unpublished until it is corrected.`,
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
        `Post is now valid and added to the db / updated: ${messageLink}`,
      );
    } else if (!oldPostValid && !newPostValid) {
      return;
    }
  }
}

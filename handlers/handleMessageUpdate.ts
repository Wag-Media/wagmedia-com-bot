import { logger } from "@/client";
import {
  ensureFullMessage,
  isMessageFromOddJobsChannel,
  shouldIgnoreMessage,
} from "./util";
import { Message, PartialMessage } from "discord.js";
import {
  findOrCreatePost,
  flagDeletePost,
  getPost,
  unpublishPost,
} from "@/data/post";
import { handleOddJob } from "../utils/handle-odd-job";
import { handlePost, parseMessage } from "../utils/handle-post";

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
        `Your odd job in ${messageLink} is invalid and is not being updated in the database. Please correct it.`
      );
    } else if (!oldOddJob && newOddJob) {
      logger.log(
        `Oddjob is now valid and added to the db / updated: ${messageLink}`
      );
    }
  } else {
    oldMessage = await ensureFullMessage(oldMessage);
    const oldPost = await parseMessage(oldMessage.content, oldMessage.embeds);
    const newPost = await parseMessage(newMessage.content, newMessage.embeds);

    const oldDbPost = await getPost(oldMessage.id);

    if (oldDbPost?.isPublished) {
      logger.logAndSend(
        `The post ${messageLink} is already published and cannot be edited. If you want to change it, unpublish it first.`,
        newMessage.author
      );
    } else if (oldPost && newPost) {
      await findOrCreatePost({
        message: newMessage,
        title: newPost.title,
        description: newPost.description,
        tags: newPost.tags,
        contentUrl: newPost.embedUrl,
        embedImageUrl: newPost.embedImage,
        embedColor: newPost.embedColor,
      });
      logger.log(`Post updated in the channel ${messageLink}`);
    } else if (oldPost && !newPost) {
      await flagDeletePost(newMessage.id);
      logger.logAndSend(
        `Your post in ${messageLink} is invalid and is unpublished until it is corrected.`,
        newMessage.author
      );
    } else if (!oldPost && newPost) {
      await findOrCreatePost({
        message: newMessage,
        title: newPost.title,
        description: newPost.description,
        tags: newPost.tags,
        contentUrl: newPost.embedUrl,
        embedImageUrl: newPost.embedImage,
        embedColor: newPost.embedColor,
      });
      logger.log(`Post is valid and added to the db / updated: ${messageLink}`);
    } else if (!oldPost && !newPost) {
      return;
    }
  }
}

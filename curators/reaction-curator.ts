import {
  classifyMessage,
  ensureFullMessage,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForPosts,
  isParentMessageFromMonitoredCategoryOrChannel,
  shouldIgnoreMessage,
} from "@/handlers/util";
import { handleOddJob } from "@/utils/handle-odd-job";
import { PostType, handlePost, parseMessage } from "@/utils/handle-post";
import { userHasRole } from "@/utils/userHasRole";
import { Emoji, Reaction } from "@prisma/client";
import {
  Channel,
  Message,
  User as DiscordUser,
  MessageReaction,
  Guild,
} from "discord.js";

import * as config from "../config.js";
import { findOrCreateEmoji } from "@/data/emoji.js";
import { fetchPost, findOrCreatePost } from "@/data/post.js";
import { MessageCurator } from "./message-curator.js";

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class ReactionCurator {
  private static reaction: MessageReaction;
  private static user: DiscordUser;
  private static wasPartial: boolean;
  private static message: Message;
  private static messageLink: string | undefined;
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static parentId: string | undefined;
  private static isReactionFromPowerUser: boolean = false;
  private static guild: Guild | undefined;

  private static emojiType: "regular" | "category" | "payment" = "regular";

  static async curate(
    reaction: MessageReaction,
    user: DiscordUser,
    wasPartial: boolean
  ) {
    if (shouldIgnoreMessage(this.message)) {
      return;
    }

    this.reaction = reaction;
    this.user = user;
    this.wasPartial = wasPartial;

    // 0. initialize variables that are required often
    this.guild = reaction.message.guild!;
    this.messageLink = `https://discord.com/channels/${guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

    const classifiedMessage = classifyMessage(this.message);
    this.messageChannelType = classifiedMessage.messageChannelType;
    this.parentId = classifiedMessage.parentId;

    this.isReactionFromPowerUser = userHasRole(
      this.guild,
      user,
      config.ROLES_WITH_POWER
    );

    // 0.1 insert the emoji to the db
    const dbEmoji: Emoji = await findOrCreateEmoji(reaction.emoji);

    // 0.2 if the post was partial and the post is not found in the db
    // parse the whole post with all reactions

    // 1. reactions to a message in a thread
    if (this.parentId) {
      await this.curateThreadReaction();
    } else if (this.messageChannelType === "post") {
      this.curatePostReaction();
    } else if (this.messageChannelType === "oddjob") {
      this.curateOddJobReaction();
    }
  }

  static async curateThreadReaction() {
    if (!this.isReactionFromPowerUser) {
      return;
    }
  }

  static async curatePostReaction() {
    let post = await fetchPost(this.reaction);

    // when the post is not found in the db or
    // TODO when the post was partial
    // TODO or the number of reactions is different from the number of emojis in the db
    if (!post) {
      // TODO: call the curate function with every emoji the post received after adding it to the db

      const { message: fullMessage, wasPartial } = await ensureFullMessage(
        this.reaction.message
      );

      MessageCurator.curate(fullMessage, this.wasPartial);

      const allMessageReactions = await this.reaction.message.reactions.cache;
      for (const [, messageReaction] of allMessageReactions) {
        await this.curate(messageReaction, this.user, false);
      }
    }
  }

  static async curateOddJobReaction() {
    // TODO
  }
}

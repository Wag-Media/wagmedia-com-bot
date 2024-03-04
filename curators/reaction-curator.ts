import {
  classifyMessage,
  classifyReaction,
  ensureFullMessage,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForPosts,
  isParentMessageFromMonitoredCategoryOrChannel,
  shouldIgnoreMessage,
} from "@/handlers/util";
import { handleOddJob } from "@/utils/handle-odd-job";
import { PostType, handlePost, parseMessage } from "@/utils/handle-post";
import { userHasRole } from "@/utils/userHasRole";
import { Emoji, Reaction, User } from "@prisma/client";
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
import { Type } from "typescript";
import { discordClient, logger } from "@/client.js";
import { emojiType } from "../types";

export type TypeCuratorPartial = {
  message: boolean;
  user: boolean;
  reaction: boolean;
};

/**
 * A message curator handles bot internal message logic, e.g. parsing a message, deciding its type (post / oddjob)
 * and other logics related to message parsing
 */
export class ReactionCurator {
  private static reaction: MessageReaction;
  private static dbEmoji: Emoji;
  private static user: DiscordUser;
  private static dbUser: User | undefined;
  private static wasPartial: TypeCuratorPartial;
  private static message: Message;
  private static messageLink: string | undefined;
  private static messageChannelType: "post" | "oddjob" | undefined;
  private static parentId: string | undefined;
  private static isReactionFromPowerUser: boolean = false;
  private static guild: Guild | undefined;

  static async curate(
    reaction: MessageReaction,
    user: DiscordUser,
    wasPartial: TypeCuratorPartial
  ) {
    this.reaction = reaction;
    this.message = reaction.message as Message; // TODO maybe move ensure logic here the message is not partial because it was ensured it is complete
    this.user = user;
    this.wasPartial = wasPartial;

    if (shouldIgnoreMessage(this.reaction.message)) {
      return;
    }

    // 0. initialize variables that are required often
    this.guild =
      reaction.message.guild ||
      (this.message.guildId &&
        (await discordClient.guilds.fetch(this.message.guildId))) ||
      undefined;

    if (!this.guild) {
      return;
    }

    this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

    const classifiedMessage = classifyMessage(this.message);
    this.messageChannelType = classifiedMessage.messageChannelType;
    this.parentId = classifiedMessage.parentId;

    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    const emojiType = await classifyReaction(this.dbEmoji);
    console.log("emoji type received", emojiType);

    this.isReactionFromPowerUser = userHasRole(
      this.guild,
      user,
      config.ROLES_WITH_POWER
    );

    const permitReaction = await this.isReactionPermitted({
      user: this.user,
      guild: this.guild,
      emojiType,
    });

    if (!permitReaction) {
      console.log(
        `user has no permission to add reactions of type ${emojiType} to messages`
      );
      return;
    }

    if (this.parentId) {
      // 1. reactions to a message in a thread
      await this.curateThreadReaction();
    } else if (this.messageChannelType === "post") {
      // 2. reactions to a message in a post channel
      await this.curatePostReaction();
    } else if (this.messageChannelType === "oddjob") {
      // 3. reactions to a message in an oddjob channel
      await this.curateOddJobReaction();
    }
  }

  static async curateThreadReaction() {
    if (!this.isReactionFromPowerUser) {
      return;
    }
  }

  static async curatePostReaction() {
    logger.log("curating post reaction", this.messageLink);
    let post = await fetchPost(this.reaction);
    const allMessageReactions = await this.reaction.message.reactions.cache;
    logger.log(
      `all message reactions for ${this.messageLink}: ${JSON.stringify(
        allMessageReactions.map((reaction) => reaction.emoji.name)
      )}`
    );

    // when the post is not found in the db or it was partial or the number of reactions is off
    // TODO or the number of reactions is different from the number of emojis in the db
    if (!post || this.wasPartial.message) {
      const { message: fullMessage, wasPartial } = await ensureFullMessage(
        this.reaction.message
      );

      MessageCurator.curate(fullMessage, this.wasPartial.message);

      // call the curate function with every emoji the post received after adding it to the db
      for (const [, messageReaction] of allMessageReactions) {
        await this.curate(messageReaction, this.user, {
          message: false,
          user: false,
          reaction: false,
        });
      }
    }
  }

  static async curateOddJobReaction() {
    // TODO
  }

  static async isReactionPermitted({
    user,
    emojiType,
    guild,
  }: {
    user: DiscordUser;
    emojiType: emojiType;
    guild: Guild;
  }): Promise<boolean> {
    return true;
  }
}

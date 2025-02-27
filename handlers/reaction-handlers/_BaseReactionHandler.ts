import {
  Guild,
  MessageReaction,
  User as DiscordUser,
  Message,
  GuildEmoji,
  ReactionEmoji,
  ApplicationEmoji,
} from "discord.js";
import { IReactionHandler } from "./_IReactionHandler";
import { getGuildFromMessage } from "@/handlers/util";
import {
  ContentType,
  EventWithOptions,
  OddJobWithOptions,
  PostWithOptions,
} from "@/types";
import { Emoji, Reaction, User } from "@prisma/client";
import { findOrCreateEmoji } from "@/data/emoji";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { getPostOrOddjobWithEarnings } from "@/data/post";
import { MessageCurator } from "../../curators/message-curator";

/**
 * Base class for reaction handlers. Takes care of initializing the reaction context
 */
export abstract class BaseReactionHandler implements IReactionHandler {
  abstract contentType: ContentType;
  protected messageLink: string;
  protected guild: Guild | null;
  protected dbEmoji: Emoji;
  protected dbUser: User | undefined;
  protected dbContent:
    | PostWithOptions
    | OddJobWithOptions
    | EventWithOptions
    | null
    | undefined;
  protected dbReaction: Reaction | null | undefined;

  async handle(reaction, user) {
    await this.initialize(reaction, user);
    if (await this.isReactionPermitted(reaction, user)) {
      await this.processReaction(reaction, user);
    }
    await this.postProcess(reaction, user);
  }

  protected async baseInitialize(reaction: MessageReaction, user: DiscordUser) {
    this.guild = await getGuildFromMessage(reaction.message);
    this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

    const emoji = reaction.emoji as GuildEmoji | ReactionEmoji;
    this.dbEmoji = await findOrCreateEmoji(emoji);
    this.dbUser = await findOrCreateUserFromDiscordUser(user);
    this.dbContent = await this.getDbContent(reaction);

    if (!this.guild) {
      throw new Error(`Guild for ${this.messageLink} not found.`);
    }

    if (!this.dbEmoji) {
      throw new Error(`Emoji for ${this.messageLink} not found.`);
    }

    if (!this.dbUser) {
      throw new Error(`User for ${this.messageLink} not found.`);
    }

    // if the bot was offline when the message was created, the content might not be found
    // in the database, so we curate it
    if (!this.dbContent) {
      this.dbContent = await MessageCurator.curate(reaction.message as Message);
    }
  }

  protected async initialize(reaction: MessageReaction, user: DiscordUser) {
    await this.baseInitialize(reaction, user);
  }

  protected getDbContent(
    reaction: MessageReaction,
  ): Promise<
    PostWithOptions | OddJobWithOptions | EventWithOptions | null | undefined
  > {
    return getPostOrOddjobWithEarnings(reaction.message.id, this.contentType);
  }

  protected abstract isReactionPermitted(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<boolean>;

  protected abstract processReaction(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void>;

  protected postProcess(
    reaction: MessageReaction,
    user: DiscordUser,
  ): Promise<void> {
    // console.log("BaseReactionHandler: Post-processing reaction");
    // Shared logic after processing payment, e.g., logging, validation
    return Promise.resolve();
  }
}

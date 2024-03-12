import {
  Guild,
  MessageReaction,
  User as DiscordUser,
  Message,
} from "discord.js";
import { IReactionHandler } from "./interface-reaction-handler";
import { getGuildFromMessage } from "@/handlers/util";
import { ContentType, OddjobWithEarnings, PostWithEarnings } from "@/types";
import { Emoji, PaymentRule, User } from "@prisma/client";
import { findOrCreateEmoji } from "@/data/emoji";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { getPostOrOddjobWithEarnings } from "@/data/post";
import { MessageCurator } from "./message-curator";

export abstract class BaseReactionHandler implements IReactionHandler {
  abstract contentType: ContentType;
  protected messageLink: string;
  protected guild: Guild | null;
  protected dbEmoji: Emoji;
  protected dbUser: User | undefined;
  protected dbContent: PostWithEarnings | OddjobWithEarnings | null | undefined;

  async handle(reaction, user, parentId) {
    console.info("BaseReactionHandler: Handling payment reaction");
    await this.initialize(reaction, user);
    await this.processReaction(reaction, user);
    await this.postProcess(reaction, user);
  }

  protected async initialize(reaction: MessageReaction, user: DiscordUser) {
    console.log("Initializing payment reaction");
    // Shared logic before processing payment, e.g., logging, validation
    this.guild = await getGuildFromMessage(reaction.message);
    this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;
    this.dbEmoji = await findOrCreateEmoji(reaction.emoji);
    this.dbUser = await findOrCreateUserFromDiscordUser(user);
    this.dbContent = await getPostOrOddjobWithEarnings(
      reaction.message.id,
      this.contentType
    );

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

  protected abstract processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void>;

  protected postProcess(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void> {
    return Promise.resolve();
  }
}

import { Guild, MessageReaction, User as DiscordUser } from "discord.js";
import { IReactionHandler } from "./interface-reaction-handler";
import { getGuildFromMessage } from "@/handlers/util";

export abstract class BaseReactionHandler implements IReactionHandler {
  protected messageLink: string;
  protected guild: Guild | null;

  async handle(reaction, user) {
    this.guild = await getGuildFromMessage(reaction.message);
    this.messageLink = `https://discord.com/channels/${this.guild.id}/${reaction.message.channel.id}/${reaction.message.id}`;

    await this.processReaction(reaction, user);
  }

  protected abstract processReaction(
    reaction: MessageReaction,
    user: DiscordUser
  ): Promise<void>;
}

import { discordClient } from "@/client";
import * as config from "../config";
import { TextChannel } from "discord.js";

export const handleOldMessagesAndReactions = async (limit: number) => {
  console.log("handleOldMessagesAndReactions");

  const channel = (await discordClient.channels.fetch(
    config.CHANNELS_TO_MONITOR[0]
  )) as TextChannel;

  console.log("channel", channel?.guild?.name);

  if (channel instanceof TextChannel) {
    const messages = await channel.messages.fetch({ limit }); // Adjust limit as needed

    for (const message of messages.values()) {
      await message.fetch();
      console.log("message", message.content);

      // Fetching all reactions for each message
      for (const reaction of message.reactions.cache.values()) {
        await reaction.fetch(); // Fetch all users who reacted with this emoji
        console.log("reaction", reaction.emoji.name);
        const users = await reaction.users.fetch();
        for (const user of users.values()) {
          console.log(
            `User ${user.tag} reacted with ${reaction.emoji.name} on message: ${message.content}`
          );
        }
      }
    }
  }
};

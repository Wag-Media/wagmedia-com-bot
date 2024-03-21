import { discordClient, logger } from "@/client";
import * as config from "../config";
import { TextChannel } from "discord.js";
import { delay } from "./util";
import { CHANNELS_TO_MONITOR } from "../config";

export const handleOldMessagesAndReactions = async (limit: number) => {
  const delayBetweenMessages = 500; // Delay in milliseconds (e.g., 500ms = 0.5 seconds)
  const delayBetweenChannels = 5000; // Delay in milliseconds (e.g., 5000ms = 5 seconds)

  let channelCount = 0;
  let messageCount = 0;
  let reactionCount = 0;

  const CHANNELS_TO_MONITOR = process.env.CHANNELS_TO_MONITOR
    ? JSON.parse(process.env.CHANNELS_TO_MONITOR)
    : [];

  try {
    for (const channelId of CHANNELS_TO_MONITOR) {
      const channel = (await discordClient.channels.fetch(
        channelId,
      )) as TextChannel;
      logger.log(
        `Looking for old messages and reactions in channel: #${channel?.guild?.name} - ${channel?.name}`,
      );

      if (channel) {
        channelCount++;
        const messages = await channel.messages.fetch({ limit }); // Adjust limit as needed

        for (const message of messages.values()) {
          await message.fetch();
          messageCount++;

          // Fetching all reactions for each message
          for (const reaction of message.reactions.cache.values()) {
            await reaction.fetch(); // Fetch all users who reacted with this emoji
            reactionCount++;

            const users = await reaction.users.fetch();
            for (const user of users.values()) {
              logger.log(
                `User ${user.tag} reacted with ${reaction.emoji.name} on message: ${message.id}`,
              );
            }
          }

          await delay(delayBetweenMessages);
        }
      }

      await delay(delayBetweenChannels);
    }
  } catch (error) {
    logger.error("Error fetching old messages and reactions:", error);
  }

  logger.log(
    `Fetched ${messageCount} old messages and ${reactionCount} reactions from ${channelCount} channels.`,
  );
};

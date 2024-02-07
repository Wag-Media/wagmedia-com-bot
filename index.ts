import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { discordClient, logger } from "./client";
import * as config from "./config.js";
import { handleMessageCreate } from "./handlers/handleMessageCreate.js";
import { handleMessageReactionAdd } from "./handlers/handleMessageReactionAdd.js";
import { handleMessageReactionRemove } from "./handlers/handleMessageReactionRemove.js";
import { handleOldMessagesAndReactions } from "./handlers/handleOldMessagesAndReactions.js";
import { handleMessageUpdate } from "./handlers/handleMessageUpdate.js";
import { handleMessageDelete } from "./handlers/handleMessageDelete.js";
import { ChannelType, Collection, Events } from "discord.js";

//store your token in environment variable or put it here
const token = process.env["DISCORD_BOT_TOKEN"];

discordClient.on(Events.ClientReady, () => {
  // Iterate over all guilds the bot is part of
  discordClient.guilds.cache.forEach(async (guild) => {
    if (guild.id !== config.GUILD_ID) {
      logger.warn(
        `Guild is not configured as the guild the bot should work with. Leaving guild: ${guild.name}`
      );
      guild.leave();
    }

    logger.info(`Connected to guild: ${guild.name} (${guild.id})`);
    logger.info(`logged in as ${discordClient.user?.tag}!`);

    let monitoredChannelCount = config.CATEGORIES_TO_MONITOR.length;

    const guildChannels = await guild.channels.fetch();
    const monitoredCategoriesChannels = guildChannels.filter(
      (channel) =>
        channel &&
        channel.type === ChannelType.GuildText && // Adjust this if you're looking for voice channels, etc.
        channel.parentId && // Ensure channel has a parent
        config.CATEGORIES_TO_MONITOR.includes(channel.parentId)
    );

    logger.info(
      `Listening for posts and post reactions in ${
        monitoredChannelCount + monitoredCategoriesChannels.size
      } channels in guild ${guild.name}:`
    );

    logger.info(
      config.CHANNELS_TO_MONITOR.map((channelId) => {
        const channel = guild.channels.cache.get(channelId);
        return `↪ #${channel?.name} (${channel?.id})`;
      }).join("\n")
    );

    monitoredCategoriesChannels?.forEach((channel) => {
      logger.info(
        `↪ ${channel?.parent?.name} ↪ #${channel?.name} (${channel?.id})`
      );
    });

    logger.info(
      `Listening for oddjobs and oddjob reactions in ${config.CHANNELS_ODD_JOBS.length} channels in guild ${guild.name}:`
    );
    logger.info(
      config.CHANNELS_ODD_JOBS.map((channelId) => {
        const channel = guild.channels.cache.get(channelId);
        return `↪ #${channel?.name} (${channel?.id})`;
      }).join("\n")
    );
  });
});

discordClient.on(Events.Error, console.error);
discordClient.on(Events.Warn, console.warn);
discordClient.on("disconnect", () => {
  console.info("Disconnected from discord.");
});
discordClient.on(Events.ShardReconnecting, () => {
  console.info("Reconnecting to discord.");
});

discordClient.on(Events.MessageCreate, async (message) => {
  try {
    await handleMessageCreate(message);
  } catch (error) {
    console.error("Error in messageCreate event handler:", error);
  }
});

discordClient.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    await handleMessageUpdate(oldMessage, newMessage);
  } catch (error) {
    console.error("Error in messageUpdate event handler:", error);
  }
});

discordClient.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    await handleMessageReactionAdd(reaction, user);
  } catch (error) {
    console.error("Error in messageReactionAdd event handler:", error);
  }
});

discordClient.on(Events.MessageReactionRemove, async (reaction, user) => {
  try {
    await handleMessageReactionRemove(reaction, user);
  } catch (error) {
    console.error("Error in messageReactionRemove event handler:", error);
  }
});

discordClient.on(Events.MessageDelete, async (message) => {
  try {
    await handleMessageDelete(message);
  } catch (error) {
    console.error("Error in messageReactionRemoveAll event handler:", error);
  }
});

discordClient.login(token);

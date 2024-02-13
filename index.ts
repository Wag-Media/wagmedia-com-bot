import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { discordClient, logger } from "./client";
import { handleMessageCreate } from "./handlers/handleMessageCreate.js";
import { handleMessageReactionAdd } from "./handlers/handleMessageReactionAdd.js";
import { handleMessageReactionRemove } from "./handlers/handleMessageReactionRemove.js";
import { handleMessageUpdate } from "./handlers/handleMessageUpdate.js";
import { handleMessageDelete } from "./handlers/handleMessageDelete.js";
import { Events } from "discord.js";
import { logIntroMessage } from "./handlers/log-utils.js";

import * as config from "./config.js";

//store your token in environment variable in .env
const token = process.env["DISCORD_BOT_TOKEN"];

discordClient.on(Events.Error, logger.error);
discordClient.on(Events.Warn, logger.warn);
discordClient.on("disconnect", () => {
  logger.info("Disconnected from discord.");
});
discordClient.on(Events.ShardReconnecting, () => {
  logger.info("Reconnecting to discord.");
});

discordClient.on(Events.ClientReady, () => {
  console.log("Bot is ready", config.GUILD_ID, config.CATEGORIES_TO_MONITOR);

  if (!config.GUILD_ID) {
    logger.error(
      "GUILD_ID is not set in the environment variables. Please set it and try again."
    );
    process.exit(1);
  }

  console.log(discordClient.guilds.cache);

  // Iterate over all guilds the bot is part of
  discordClient.guilds.cache.forEach(async (guild) => {
    if (guild.id !== config.GUILD_ID.toString()) {
      logger.warn(
        `Guild is not configured as the guild the bot should work with. Leaving guild: ${guild.name}`
      );
      guild.leave();
    }

    logIntroMessage(guild, discordClient);
  });
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
    console.error("Error in messageDelete event handler:", error);
  }
});

discordClient.login(token);

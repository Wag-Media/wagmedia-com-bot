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
import { Events } from "discord.js";

//store your token in environment variable or put it here
const token = process.env["DISCORD_BOT_TOKEN"];

discordClient.on(Events.ClientReady, () => {
  logger.log(`logged in as ${discordClient.user?.tag}!`);

  if (config.FETCH_OLD_MESSAGES) {
    handleOldMessagesAndReactions(config.FETCH_OLD_MESSAGES_LIMIT || 10);
  }
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

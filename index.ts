import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { discordClient, logger } from "./client";
import * as config from "./config.js";
import { Emoji, MessageReaction, TextChannel, User } from "discord.js";

import { PrismaClient } from "@prisma/client";

import { handleMessageCreate } from "./handlers/handleMessageCreate.js";
import { handleMessageReactionAdd } from "./handlers/handleMessageReactionAdd.js";
import { DiscordLogger } from "./utils/DiscordLogger.js";
import { handleMessageReactionRemove } from "./handlers/handleMessageReactionRemove.js";
import { handleOldMessagesAndReactions } from "./handlers/handleOldMessagesAndReactions.js";

//store your token in environment variable or put it here
const token = process.env["DISCORD_BOT_TOKEN"];

discordClient.on("ready", () => {
  logger.log(`logged in as ${discordClient.user?.tag}!`);

  if (config.FETCH_OLD_MESSAGES) {
    handleOldMessagesAndReactions(config.FETCH_OLD_MESSAGES_LIMIT || 10);
  }
});

discordClient.on("error", console.error);
discordClient.on("warn", console.warn);
discordClient.on("disconnect", () => {
  console.info("Disconnected from discord.");
});
discordClient.on("reconnecting", () => {
  console.info("Reconnecting to discord.");
});

discordClient.on("messageCreate", async (message) => {
  try {
    await handleMessageCreate(message);
  } catch (error) {
    console.error("Error in messageCreate event handler:", error);
  }
});

discordClient.on("messageReactionAdd", async (reaction, user) => {
  try {
    await handleMessageReactionAdd(reaction, user);
  } catch (error) {
    console.error("Error in messageReactionAdd event handler:", error);
  }
});

discordClient.on("messageReactionRemove", async (reaction, user) => {
  try {
    await handleMessageReactionRemove(reaction, user);
  } catch (error) {
    console.error("Error in messageReactionRemove event handler:", error);
  }
});

discordClient.login(token);

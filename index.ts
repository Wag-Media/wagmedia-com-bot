import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { discordClient, logger } from "./client";
import * as config from "./config.js";
import { Emoji, MessageReaction, User } from "discord.js";

import { PrismaClient } from "@prisma/client";

import { handleMessageCreate } from "./handlers/handleMessageCreate.js";
import { handleMessageReactionAdd } from "./handlers/handleMessageReactionAdd.js";
import { DiscordLogger } from "./utils/DiscordLogger.js";

//store your token in environment variable or put it here
const token = process.env["DISCORD_BOT_TOKEN"];
const prisma = new PrismaClient();

discordClient.on("ready", () => {
  logger.log(`logged in as ${discordClient.user?.tag}!`);
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

discordClient.on(
  "messageReactionRemove",
  async (reaction: MessageReaction, user: User) => {
    try {
      if (reaction.message.partial) await reaction.message.fetch(); // If the message is not cached
      if (reaction.partial) await reaction.fetch(); // If the reaction is not cached
      if (user.bot) return; // Ignore bot reactions

      // Uncomment and use your logic here
      // Ensure this logic is also wrapped in try-catch if it can throw errors
    } catch (error) {
      console.error("Error in messageReactionRemove handler:", error);
    }
  }
);

discordClient.login(token);

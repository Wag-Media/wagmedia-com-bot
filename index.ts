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
import { ensureFullEntities, ensureFullMessage } from "./handlers/util.js";
import { MessageCurator } from "./curators/message-curator.js";
import { ReactionCurator } from "./curators/reaction-curator.js";

//store your token in environment variable in .env
const token = process.env["DISCORD_BOT_TOKEN"];

discordClient.on(Events.Error, logger.error);
discordClient.on(Events.Warn, logger.warn);
discordClient.on("disconnect", () => {
  logger.info("Disconnected from discord.");
});

discordClient.on(Events.GuildCreate, async (joinedGuild) => {
  // Check if the joined guild's ID matches the BOT_GUILD_ID from the environment variable

  if (joinedGuild.id !== config.GUILD_ID) {
    try {
      await joinedGuild.leave();
      logger.info(`Bot left the guild with ID: ${joinedGuild.id}`);
    } catch (error) {
      logger.error(`Error leaving the guild with ID: ${joinedGuild.id}`, error);
    }
  }
});

discordClient.once(Events.ClientReady, async () => {
  if (!config.GUILD_ID) {
    console.error(
      "GUILD_ID is not set in the environment variables. Please set it and try again."
    );
    process.exit(1);
  }

  let onCorrectGuild = false;

  // Iterate over all guilds the bot is part of
  discordClient.guilds.cache.forEach(async (guild) => {
    if (guild.id !== config.GUILD_ID.toString()) {
      console.warn(
        `Guild is not configured as the guild the bot should work with, guild: ${guild.name}`
      );
      // guild.leave();
    } else {
      logIntroMessage(guild, discordClient);
      onCorrectGuild = true;
    }
  });

  if (!onCorrectGuild) {
    console.error(
      `The bot is not part of the guild with the ID ${config.GUILD_ID}. Please add the bot to the correct guild and try again.`
    );
    process.exit(1);
  }

  await discordClient.user?.setActivity(config.BOT_ACTIVITY);
});

discordClient.on(Events.MessageCreate, async (message) => {
  try {
    const { message: fullMessage, wasPartial } = await ensureFullMessage(
      message
    );
    await MessageCurator.curate(fullMessage, wasPartial);
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
    const {
      reaction: fullReaction,
      user: fullUser,
      wasPartial,
    } = await ensureFullEntities(reaction, user);

    console.log(
      "received a message reaction add event. WasPartial:",
      wasPartial,
      reaction
    );

    await ReactionCurator.curate(fullReaction, fullUser, wasPartial);

    // await handleMessageReactionAdd(reaction, user);
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

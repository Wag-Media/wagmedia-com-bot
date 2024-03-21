import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { discordClient, logger } from "./client";
import { Events } from "discord.js";
import { logIntroMessage } from "./handlers/log-utils.js";

import * as config from "@/config";
import { ensureFullEntities, ensureFullMessage } from "./handlers/util.js";
import { MessageCurator } from "@/curators/message-curator";
import { ReactionCurator } from "@/curators/ReactionCurator.js";
import { ReactionTracker } from "@/reaction-tracker.js";

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
      "GUILD_ID is not set in the environment variables. Please set it and try again.",
    );
    process.exit(1);
  }

  let onCorrectGuild = false;

  // Iterate over all guilds the bot is part of
  discordClient.guilds.cache.forEach(async (guild) => {
    if (guild.id !== config.GUILD_ID.toString()) {
      console.warn(
        `Guild is not configured as the guild the bot should work with, guild: ${guild.name}`,
      );
      // guild.leave();
    } else {
      logIntroMessage(guild, discordClient);
      onCorrectGuild = true;
    }
  });

  if (!onCorrectGuild) {
    console.error(
      `The bot is not part of the guild with the ID ${config.GUILD_ID}. Please add the bot to the correct guild and try again.`,
    );
    process.exit(1);
  }

  await discordClient.user?.setActivity(config.BOT_ACTIVITY);
});

discordClient.on(Events.MessageCreate, async (message) => {
  try {
    const { message: fullMessage } = await ensureFullMessage(message);
    await MessageCurator.curate(fullMessage);
  } catch (error) {
    console.error("Error in messageCreate event handler:", error);
  }
});

discordClient.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  try {
    const { message: oldFullMessage } = await ensureFullMessage(oldMessage);
    await MessageCurator.curateUpdate(oldFullMessage, newMessage);
  } catch (error) {
    console.error("Error in messageUpdate event handler:", error);
  }
});

discordClient.on(Events.MessageDelete, async (message) => {
  try {
    await MessageCurator.curateDelete(message);
  } catch (error) {
    console.error("Error in messageDelete event handler:", error);
  }
});

discordClient.on(Events.MessageReactionAdd, async (reaction, user) => {
  console.log("Events.MessageReactionAdd");
  try {
    const {
      reaction: fullReaction,
      user: fullUser,
      wasPartial,
    } = await ensureFullEntities(reaction, user);

    await ReactionCurator.curateAdd(fullReaction, fullUser);
    console.log("curate add done");
  } catch (error) {
    console.error("Error in messageReactionAdd event handler:", error);
  }
});

discordClient.on(Events.MessageReactionRemove, async (reaction, user) => {
  console.log("Events.MessageReactionRemove");
  try {
    const { reaction: fullReaction, user: fullUser } = await ensureFullEntities(
      reaction,
      user,
    );

    // Use ReactionTracker to check if the removal was tracked (initiated by the bot)
    // and if so, remove the reaction from the tracker and return
    if (ReactionTracker.isReactionTracked(fullReaction, fullUser.id)) {
      console.info(
        "the reaction",
        reaction.emoji.name || reaction.emoji.id,
        "was removed by the bot and will not be handled here",
      );
      ReactionTracker.removeTrackedReaction(fullReaction, fullUser.id);
      return;
    }

    // Otherwise, curate the removal
    await ReactionCurator.curateRemove(fullReaction, fullUser);
  } catch (error) {
    console.error("Error in messageReactionRemove event handler:", error);
  }
});

discordClient.login(token);

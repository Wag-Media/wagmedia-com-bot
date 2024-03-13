import { logger } from "@/client";
import { prisma } from "@/utils/prisma";
import { OddJob, Post } from "@prisma/client";
import { MessageReaction, User as DiscordUser, ChannelType } from "discord.js";
import * as config from "@/config";
import { ContentType } from "@/types";

export function logNewEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.info(
    `new emoji received on post ${messageLink} ${JSON.stringify(
      reaction.emoji.name
    )} by ${user.displayName}`
  );
}

export function logNewRegularUserEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.info(
    `new regular user emoji recorded on valid post ${messageLink} ${JSON.stringify(
      reaction.emoji.name
    )} by ${user.displayName}`
  );
}

export function logEmojiRemoved(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.info(
    `Reaction ${reaction.emoji.name} removed from message ${messageLink} by user ${user.username}#${user.discriminator}.`
  );
}

export async function logContentEarnings(
  entity: Post | OddJob,
  contentType: ContentType,
  messageLink: string
) {
  if (!contentType) {
    logger.error("Invalid content type in logContentEarnings");
    return;
  }

  const earningsCondition = ["post", "thread"].includes(contentType)
    ? { postId: entity.id }
    : { oddJobId: entity.id };

  // Fetch all earnings for the post after the update
  const allPostEarnings = await prisma.contentEarnings.findMany({
    where: earningsCondition,
  });

  // log the total earnings of the post
  const totalEarningsPerUnit = allPostEarnings.reduce(
    (acc, curr) => ({ ...acc, [curr.unit]: curr.totalAmount }),
    {}
  );

  // create a comma separated human readable string
  const humanReadableTotalEarnings = Object.keys(totalEarningsPerUnit)
    .map((key) => `${totalEarningsPerUnit[key]} ${key}`)
    .join(", ");

  logger.log(
    `[${contentType}] New total earnings for ${messageLink}: **${humanReadableTotalEarnings}**`
  );
}

export async function logOddjobEarnings(oddjob: OddJob, messageLink: string) {
  // Fetch all earnings for the post after the update
  const allOddjobEarnings = await prisma.contentEarnings.findMany({
    where: {
      oddJobId: oddjob.id,
    },
  });

  // log the total earnings of the post
  const totalEarningsPerUnit = allOddjobEarnings.reduce(
    (acc, curr) => ({ ...acc, [curr.unit]: curr.totalAmount }),
    {}
  );

  // create a comma separated human readable string
  const humanReadableTotalEarnings = Object.keys(totalEarningsPerUnit)
    .map((key) => `${key}: ${totalEarningsPerUnit[key]}`)
    .join(", ");

  logger.log(
    `[oddjob] Total earnings for ${messageLink}: ${humanReadableTotalEarnings}`
  );
}

export async function logIntroMessage(guild, discordClient) {
  logger.info(`⚡️ Connected to guild: ${guild.name} (${guild.id})`);
  logger.info(`🤖 Logged in as ${discordClient.user?.tag}!`);

  let monitoredChannelCount = config.CHANNELS_TO_MONITOR.length;

  const guildChannels = await guild.channels.fetch();
  const monitoredCategoriesChannels = guildChannels.filter(
    (channel) =>
      channel &&
      channel.type === ChannelType.GuildText && // Adjust this if you're looking for voice channels, etc.
      channel.parentId && // Ensure channel has a parent
      config.CATEGORIES_TO_MONITOR.includes(channel.parentId)
  );

  logger.info(
    `🦻 Listening for posts and post reactions in ${
      monitoredChannelCount + monitoredCategoriesChannels.size
    } channels in guild ${guild.name}:`
  );

  config.CHANNELS_TO_MONITOR.map((channelId) => {
    const channel = guild.channels.cache.get(channelId);
    logger.info(`↪ #${channel?.name} (${channel?.id})`);
  });

  monitoredCategoriesChannels?.forEach((channel) => {
    logger.info(
      `↪ ${channel?.parent?.name} ↪ #${channel?.name} (${channel?.id})`
    );
  });

  logger.info(
    `🦻 Listening for oddjobs and oddjob reactions in ${config.CHANNELS_ODD_JOBS.length} channels in guild ${guild.name}:`
  );
  config.CHANNELS_ODD_JOBS.map((channelId) => {
    const channel = guild.channels.cache.get(channelId);
    logger.info(`↪ #${channel?.name} (${channel?.id})`);
  });
}

export async function logAndSend(message, user) {}

/**
 * Wraps all URLs in a message with <> to prevent Discord embeds.
 * @param {string} message The message that may contain URLs.
 * @return {string} The message with all URLs wrapped in <>.
 */
export function wrapUrlsInMessage(message: string): string {
  // Regular expression to match URLs
  const urlRegex =
    /(\bhttps?:\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
  // Replace each URL with the same URL wrapped in <>
  return message.replace(urlRegex, "<$1>");
}

import { logger } from "@/client";
import { MessageReaction, User as DiscordUser } from "discord.js";

export function logNewEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.log(
    `new emoji received on valid post ${messageLink} ${JSON.stringify(
      reaction.emoji.name
    )} by ${user.displayName}`
  );
}

export function logNewRegularUserEmojiReceived(
  reaction: MessageReaction,
  user: DiscordUser,
  messageLink: string
) {
  logger.log(
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
  logger.log(
    `Reaction ${reaction.emoji.name} removed from message ${messageLink} by user ${user.username}#${user.discriminator}.`
  );
}

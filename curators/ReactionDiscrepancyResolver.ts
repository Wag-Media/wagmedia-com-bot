import {
  Message,
  MessageReaction,
  PartialMessage,
  User as DiscordUser,
} from "discord.js";
import { ReactionCurator } from "./ReactionCurator";
import { determineContentType, determineUserRole } from "./utils";
import {
  getPostOrOddjob,
  getPostOrOddjobReactionCount,
  resetPostOrOddjobReactions,
} from "@/data/post";
import { logger } from "@/client";
import {
  ContentType,
  DiscordReaction,
  ReactionEventType,
  ReactionWithEmoji,
} from "@/types";
import { getPostOrOddjobReactions, removeReactions } from "@/data/reaction";
import { Reaction } from "@prisma/client";
import { loggableDbEmoji, loggableDiscordEmoji } from "@/handlers/log-utils";
import { FORCE_REACTION_RESOLUTION_EMOJI } from "@/config";
import { ensureFullMessage } from "@/handlers/util";

export interface ReactionDiscrepancies {
  missingInDb: DiscordReaction[];
  extraInDb: ReactionWithEmoji[];
}

/**
 * This class is responsible for checking and resolving discrepancies between the database and Discord reactions.
 * It is used to ensure that the database and Discord reactions are in sync.
 *
 * If a discrepancy is detected, all reactions and payments and connected entities are removed from the database and re-added in the
 * sequence they appeared.
 */
export class ReactionDiscrepancyResolver {
  private static contentType: ContentType;
  private static parentId: string | undefined;

  static async checkAndResolve(
    message: Message,
    event: ReactionEventType,
    reaction?: MessageReaction,
    user?: DiscordUser,
  ): Promise<boolean> {
    const { contentType, parentId } = determineContentType(message);
    this.contentType = contentType;
    this.parentId = parentId;

    const discrepancies = await this.detectDiscrepancies(
      message,
      event,
      reaction,
      user,
    );

    if (
      discrepancies.extraInDb.length > 0 ||
      discrepancies.missingInDb.length > 0
    ) {
      const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

      logger.warn(
        `[${this.contentType}] 👀 reaction discrepancies detected on ${messageLink}
        ${discrepancies.extraInDb.length > 0 ? "\n**extras in db:**" : ""}
        ${discrepancies.extraInDb
          .map((r) => `${loggableDbEmoji(r.emoji)} by <@${r.userDiscordId}>`)
          .join(", ")}
        ${discrepancies.missingInDb.length > 0 ? "**missing in db:**" : ""}
        ${discrepancies.missingInDb
          .map((r) => `${loggableDiscordEmoji(r.emoji)} by <@${r.user.id}>`)
          .join(", ")}`,
      );

      if (discrepancies.extraInDb.length > 0) {
        for (const { userDiscordId, emojiId } of discrepancies.extraInDb) {
          const reactionGuildMember =
            await message.guild?.members.fetch(userDiscordId);

          if (!reactionGuildMember) {
            continue;
          }

          const mockDiscordReaction = {
            message: message,
            emoji: {
              name: emojiId,
              animated: false,
              imageURL: undefined,
              discordId: emojiId,
            },
          };

          // remove the reaction from discord
          await ReactionCurator.curateRemove(
            // todo is this really safe?
            mockDiscordReaction as unknown as MessageReaction,
            reactionGuildMember.user,
          );
        }
      }

      if (discrepancies.missingInDb.length > 0) {
        for (const { reaction, user } of discrepancies.missingInDb) {
          if (!reaction) {
            continue;
          }

          await ReactionCurator.curateAdd(reaction, user);
        }
      }

      const dbReactionsAfterResolution = (
        await getPostOrOddjobReactions(message.id, this.contentType)
      )
        .map((r) => loggableDbEmoji(r.emoji))
        .join(", ");

      logger.log(
        `[${this.contentType}] Discrepancies were handled successfully, the reactions state in the database is now in sync with Discord ${messageLink}:
        ${dbReactionsAfterResolution}`,
      );
    }

    return (
      discrepancies.extraInDb.length > 0 || discrepancies.missingInDb.length > 0
    );
  }

  /**
   * A discrepancy is detected if
   * - the message that was reacted to is not in the database
   * - the heuristic that
   * -- number of reactions in the database is the same as the number of reactions in Discord is violated or
   * -- the last discord emojiId is different from the last emojiId in the database
   * @param message
   * @returns
   */
  private static async detectDiscrepancies(
    message: Message,
    event: ReactionEventType,
    reaction?: MessageReaction,
    user?: DiscordUser,
  ): Promise<ReactionDiscrepancies> {
    const noDiscrepancies: ReactionDiscrepancies = {
      missingInDb: [],
      extraInDb: [],
    };

    if (!message.id) {
      return noDiscrepancies;
    }

    if (this.parentId) {
      return noDiscrepancies;
    }

    const dbPostOrOddjob = await getPostOrOddjob(message.id, this.contentType);

    const dbReactions = await getPostOrOddjobReactions(
      message.id,
      this.contentType,
    );

    if (!dbPostOrOddjob) {
      // if the message is a thread it is not necessarily in the db yet
      // as it will only be added on payment. so we can ignore it here
      // if it is already tracked the discrepancy detection will continue below in another case
      if (this.parentId) {
        return noDiscrepancies;
      }
    }

    if (
      this.isDbReactionStateSuspicious(message, dbReactions, event) ||
      (await this.forceReactionResolution(reaction, user))
    ) {
      // fetch all reactions from discord in a long lasting operation
      const discordReactions: DiscordReaction[] = [];
      for (const [_, messageReaction] of message.reactions.cache) {
        const users = await messageReaction.users.fetch();

        for (const user of users.values()) {
          discordReactions.push({
            user: user,
            emoji: messageReaction.emoji,
            reaction: messageReaction,
          });
        }
      }
      return this.findReactionDiscrepancies(discordReactions, dbReactions);
    }

    return noDiscrepancies;
  }

  private static async forceReactionResolution(
    reaction?: MessageReaction,
    user?: DiscordUser,
  ): Promise<boolean> {
    if (!reaction || !user) {
      return false;
    }

    const message = (await ensureFullMessage(reaction.message)).message;
    const userRole = await determineUserRole(message, user);

    if (
      reaction.emoji.name === FORCE_REACTION_RESOLUTION_EMOJI &&
      userRole === "superuser"
    ) {
      return true;
    }

    return false;
  }

  // returns true if either the count or the last emojiId is different from the discord count
  private static isDbReactionStateSuspicious(
    message: Message,
    dbReactions: Reaction[],
    event: ReactionEventType,
  ): boolean {
    const discordReactions = Array.from(message.reactions.cache.values());
    const discordReactionCount = discordReactions.reduce(
      (acc, reaction) => acc + reaction.count,
      0,
    );

    // 1. check if the number of reactions is expected
    const dbReactionCount = dbReactions.length;

    let expectedReactionCount = dbReactionCount;

    if (event === "reactionAdd") {
      expectedReactionCount += 1;
    } else if (event === "reactionRemove") {
      expectedReactionCount -= 1;
    }

    if (expectedReactionCount !== discordReactionCount) {
      console.warn(
        `[${this.contentType}] Discrepancy detected: number of expected reactions (${expectedReactionCount}) is different from the number of reactions in Discord (${discordReactionCount}) on ${event}`,
      );
      return true;
    }

    // 2. check if the last discord emoji is the same as the last db emoji,
    //only a heuristic, if e.g. the last discord emoji was a count + 1
    // of already existing one this will not fire
    const lastDbReaction = dbReactions[dbReactions.length - 1];
    if (!lastDbReaction) {
      return false;
    }

    //todo flow
    if (discordReactions.length > 1) {
      const lastDiscordReaction = discordReactions[discordReactions.length - 2];

      const lastDiscordEmojiId =
        lastDiscordReaction.emoji.name || lastDiscordReaction.emoji.id;

      console.log("lastDbReaction.emojiId", lastDbReaction.emojiId);

      if (lastDbReaction.emojiId !== lastDiscordEmojiId) {
        console.warn(
          `[${this.contentType}] Discrepancy detected: last emojiId in the database (${lastDbReaction.emojiId}) is different from the last emojiId in Discord (${lastDiscordEmojiId})`,
        );
        return true;
      }
    }

    return false;
  }

  private static async findReactionDiscrepancies(
    discordReactions: DiscordReaction[],
    dbReactions: Reaction[],
  ): Promise<ReactionDiscrepancies> {
    const missingInDb: DiscordReaction[] = [];
    const extraInDb: Reaction[] = [];

    // Check for reactions in Discord that are missing in DB
    for (const discordReaction of discordReactions) {
      const matchingDbReaction = dbReactions.find(
        (dbReaction) =>
          dbReaction.userDiscordId === discordReaction.user.id &&
          dbReaction.emojiId ===
            (discordReaction.emoji.name || discordReaction.emoji.id),
      );

      if (!matchingDbReaction) {
        missingInDb.push(discordReaction);
      }
    }

    // Check for reactions in DB that are missing in Discord
    for (const dbReaction of dbReactions) {
      const matchingDiscordReaction = discordReactions.find(
        (discordReaction) =>
          dbReaction.userDiscordId === discordReaction.user.id &&
          dbReaction.emojiId ===
            (discordReaction.emoji.name || discordReaction.emoji.id),
      );

      if (!matchingDiscordReaction) {
        extraInDb.push(dbReaction);
      }
    }

    return {
      missingInDb,
      extraInDb,
    };
  }
}

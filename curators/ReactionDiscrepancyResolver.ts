import { Message, MessageReaction, PartialMessage } from "discord.js";
import { ReactionCurator } from "./ReactionCurator";
import { determineContentType } from "./utils";
import {
  getPostOrOddjob,
  getPostOrOddjobReactionCount,
  resetPostOrOddjobReactions,
} from "@/data/post";
import { logger } from "@/client";
import { ReactionEventType } from "@/types";

/**
 * This class is responsible for checking and resolving discrepancies between the database and Discord reactions.
 * It is used to ensure that the database and Discord reactions are in sync.
 *
 * If a discrepancy is detected, all reactions and payments and connected entities are removed from the database and re-added in the
 * sequence they appeared.
 */
export class ReactionDiscrepancyResolver {
  static async checkAndResolve(
    message: Message,
    event: ReactionEventType
  ): Promise<boolean> {
    const hasDiscrepancies = await this.detectDiscrepancies(message, event);

    if (hasDiscrepancies) {
      // 1. remove all reactions and payments and connected entities from the db
      await resetPostOrOddjobReactions(message.id);

      // 2. iterate over all reactions and re-add them
      for (const [_, messageReaction] of message.reactions.cache) {
        const users = await messageReaction.users.fetch();
        for (const user of users.values()) {
          // Directly reprocess each reaction. Thanks to the flag in ReactionCurator,
          // this won't trigger an additional discrepancy check.
          await ReactionCurator.curateAdd(messageReaction, user);
        }
      }
    }

    return hasDiscrepancies;
  }

  /**
   * A discrepancy is detected if
   * - the message that was reacted to is not in the database
   * - the number of reactions in the database is different from the number of
   *   reactions in Discord
   * @param message
   * @returns
   */
  private static async detectDiscrepancies(
    message: Message,
    event: ReactionEventType
  ): Promise<boolean> {
    const { contentType, parentId } = determineContentType(message);

    if (!message.id) {
      return true;
    }

    if (parentId) {
      return false;
    }

    const dbPostOrOddjob = await getPostOrOddjob(message.id, contentType);

    if (!dbPostOrOddjob) {
      // if the message is a thread it is not necessarily in the db yet
      // as it will only be added on payment. so we can ignore it here
      // if it is already tracked the discrepancy detection will continue below in another case
      if (parentId) {
        return false;
      } else {
        logger.warn(
          `[${contentType}] detectDiscrepancy: ${contentType} with id ${message.id} not found in the database.`
        );
        return true;
      }
    }

    const dbPostOrOddjobReactionCount = await getPostOrOddjobReactionCount(
      message.id,
      contentType
    );

    let discordReactionCount = 0;
    message.reactions.cache.forEach((messageReaction) => {
      discordReactionCount += messageReaction.count;
    });

    let expectedReactionCount = dbPostOrOddjobReactionCount || 0;

    console.log("expectedReactionCount", expectedReactionCount);

    // as we are in an event handler we need to adjust the expected reaction count
    // - reaction was just added there should be +1 on discord
    // - reaction was just removed there should be -1 on discord
    if (event === "reactionAdd") {
      expectedReactionCount += 1;
    } else if (event === "reactionRemove") {
      expectedReactionCount -= 1;
    }

    if (discordReactionCount !== expectedReactionCount) {
      logger.warn(
        `[${contentType}] ${contentType} with ID ${message.id} has a different number of reactions in the database on ${event}.`,
        ` discord: ${discordReactionCount}`,
        ` db: ${dbPostOrOddjobReactionCount}`
      );
      return true;
    }

    return false;
  }
}

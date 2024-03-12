import { Message, MessageReaction, PartialMessage } from "discord.js";
import { ReactionCurator } from "./reaction-curator-new";
import { determineContentType } from "./utils";
import { getPostOrOddjob, getPostOrOddjobReactionCount } from "@/data/post";
import { logger } from "@/client";

export class ReactionDiscrepancyResolver {
  static async checkAndResolve(message: Message): Promise<void> {
    const hasDiscrepancies = await this.detectDiscrepancies(message);

    if (hasDiscrepancies) {
      for (const [_, messageReaction] of message.reactions.cache) {
        const users = await messageReaction.users.fetch();
        for (const user of users.values()) {
          // Directly reprocess each reaction. Thanks to the flag in ReactionCurator,
          // this won't trigger an additional discrepancy check.
          await ReactionCurator.curateAdd(messageReaction, user);
        }
      }
    }
  }

  private static async detectDiscrepancies(message: Message): Promise<boolean> {
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
    if (!dbPostOrOddjobReactionCount) {
      logger.warn(
        `[${contentType}] ${contentType} with id ${message.id} has no reactions in the database.`
      );
      return true;
    }

    const discordReactionCount = message.reactions.cache.size;

    if (discordReactionCount !== dbPostOrOddjobReactionCount + 1) {
      logger.warn(
        `[${contentType}] ${contentType} with ID ${message.id} has a different number of reactions in the database.`,
        ` discord: ${discordReactionCount - 1}`,
        ` db: ${dbPostOrOddjobReactionCount}`
      );
      return true;
    }

    return false;
  }
}

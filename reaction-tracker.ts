import { get } from "axios";
import { MessageReaction } from "discord.js";

// ReactionTracker.ts
export class ReactionTracker {
  public static botRemovedReactions = new Set<string>();
  private static readonly TIMEOUT = 60000; // 1 minute in milliseconds

  public static getKey(reaction: MessageReaction, userId: string): string {
    return `${reaction.message.id}:${userId}:${reaction.emoji.name}`;
  }

  /**
   * Add a reaction to the set of tracked reactions. We need the user id as well as
   * on delete reactions the reaction.users.cache.last() will be undefined
   * @param reaction
   * @param userId
   */
  public static addReactionToTrack(
    reaction: MessageReaction,
    userId: string
  ): void {
    const reactionKey = this.getKey(reaction, userId);
    this.botRemovedReactions.add(reactionKey);

    // Automatically remove the reaction from the set after the specified timeout
    setTimeout(() => {
      this.botRemovedReactions.delete(reactionKey);
    }, this.TIMEOUT);
  }

  public static isReactionTracked(
    reaction: MessageReaction,
    userId: string
  ): boolean {
    return this.botRemovedReactions.has(this.getKey(reaction, userId));
  }

  public static removeTrackedReaction(
    reaction: MessageReaction,
    userId: string
  ): void {
    this.botRemovedReactions.delete(this.getKey(reaction, userId));
  }
}

import { get } from "axios";
import { MessageReaction } from "discord.js";

// ReactionTracker.ts
export class ReactionTracker {
  private static botRemovedReactions = new Set<string>();
  private static readonly TIMEOUT = 60000; // 1 minute in milliseconds

  private static getKey(reaction: MessageReaction): string {
    return `${reaction.message.id}:${reaction.users.cache.last()?.id}:${
      reaction.emoji.name
    }`;
  }

  public static addReactionToTrack(reaction: MessageReaction): void {
    const reactionKey = this.getKey(reaction);
    this.botRemovedReactions.add(reactionKey);

    // Automatically remove the reaction from the set after the specified timeout
    setTimeout(() => {
      this.botRemovedReactions.delete(reactionKey);
    }, this.TIMEOUT);
  }

  public static isReactionTracked(reaction: MessageReaction): boolean {
    return this.botRemovedReactions.has(this.getKey(reaction));
  }

  public static removeTrackedReaction(reaction: MessageReaction): void {
    this.botRemovedReactions.delete(this.getKey(reaction));
  }
}

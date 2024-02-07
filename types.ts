import {
  Category,
  Emoji,
  OddJob,
  PaymentRule,
  Post,
  PostEarnings,
  User as DbUser,
} from "@prisma/client";
import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User as DiscordUser,
} from "discord.js";

export interface ReactionContext {
  reaction: MessageReaction | PartialMessageReaction;
  user: DiscordUser | PartialUser;
  messageLink: string;
  dbEmoji?: Emoji;
  dbUser?: DbUser;
  paymentRule?: PaymentRule;
  post?: Post & { categories: Category[] } & { earnings: PostEarnings[] };
  oddJob?: OddJob;
  isSuperUser: boolean;
}

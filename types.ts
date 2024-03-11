import {
  Category,
  Emoji,
  OddJob,
  PaymentRule,
  Post,
  User as DbUser,
  ContentEarnings,
  Tag,
  Embed,
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
  post?: Post & { categories: Category[] } & { earnings: ContentEarnings[] };
  oddJob?: OddJob;
  isSuperUser: boolean;
}

export type PostEmbed = {
  url: string | null;
  imageUrl: string | null;
  color: number | null;
};

export type PostWithCategories = Post & { categories: Category[] };
export type PostWithEarnings = Post & { earnings: ContentEarnings[] };

export type PostWithCategoriesTagsEmbeds = Post & {
  categories: Category[];
  tags: Tag[];
  embeds: Embed[];
};

export type emojiType = "regular" | "feature" | "category" | "payment";

export type ReactionEvent = "reactionAdd" | "reactionRemove";

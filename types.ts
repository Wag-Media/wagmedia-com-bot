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
  Payment,
} from "@prisma/client";
import {
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User as DiscordUser,
  GuildEmoji,
  ReactionEmoji,
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

export interface DiscordReaction {
  user: DiscordUser;
  emoji: GuildEmoji | ReactionEmoji;
  reaction?: MessageReaction;
}

export type PostEmbed = {
  url: string | null;
  imageUrl: string | null;
  color: number | null;
};

export type PostWithOptions = Post & {
  categories?: Category[];
  earnings?: ContentEarnings[];
  tags?: Tag[];
  embeds?: Embed[];
};
export type PostWithCategories = Post & { categories: Category[] };
export type PostWithEarnings = Post & { earnings: ContentEarnings[] };
export type PostWithPayments = Post & { payments: Payment[] };
export type PostWithPaymentsAndCategories = Post & {
  payments: Payment[];
  categories: Category[];
};
export type PostWithCategoriesEarnings = Post & {
  categories: Category[];
  earnings: ContentEarnings[];
};
export type PostFull = Post & {
  categories: Category[];
  earnings: ContentEarnings[];
  tags: Tag[];
  embeds: Embed[];
};

export type OddJobWithOptions = OddJob & {
  payments?: Payment[];
  earnings?: ContentEarnings[];
  embeds?: Embed[];
};
export type OddjobWithEarnings = OddJob & {
  earnings: ContentEarnings[];
};

export type PostWithCategoriesTagsEmbeds = Post & {
  categories: Category[];
  tags: Tag[];
  embeds: Embed[];
};

export type UserRole = "superuser" | "regular";
export type ContentType =
  | "oddjob"
  | "post"
  | "thread"
  | "newsletter"
  | undefined;
export type EmojiType =
  | "regular"
  | "feature"
  | "universalPublish"
  | "category"
  | "payment";
export type ReactionEventType = "reactionAdd" | "reactionRemove";

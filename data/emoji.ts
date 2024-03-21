import {
  Category,
  CategoryRule,
  PaymentRule,
  PrismaClient,
  Emoji,
} from "@prisma/client";
import { GuildEmoji, MessageReaction, ReactionEmoji } from "discord.js";
const prisma = new PrismaClient();

export const findEmoji = async (
  emoji: GuildEmoji | ReactionEmoji,
): Promise<Emoji | null> => {
  let emojiName: string | undefined;
  let emojiChar: string | undefined;
  let discordEmojiId: string | undefined;
  let isAnimated: boolean | undefined;
  let emojiId: string | undefined;

  if (emoji.id) {
    // This is a custom emoji
    emojiName = emoji.name ?? "unknown";
    discordEmojiId = emoji.id;
    isAnimated = emoji.animated ?? false;
    emojiId = emoji.name ?? undefined;
  } else {
    // This is a native emoji
    emojiChar = emoji.name || undefined; // Emoji itself for native emojis
    emojiId = emoji.name || undefined;
  }

  const dbEmoji = await prisma.emoji.findUnique({
    where: { id: emojiId || "unknown" },
    include: {
      PaymentRule: true, // Include PaymentRule in the emoji
    },
  });

  return dbEmoji;
};

export const findOrCreateEmoji = async (emoji: GuildEmoji | ReactionEmoji) => {
  let emojiName: string | undefined;
  let emojiChar: string | undefined;
  let discordEmojiId: string | undefined;
  let isAnimated: boolean | undefined;
  let emojiId: string | undefined;
  let emojiUrl: string | undefined;

  if (emoji.id) {
    // This is a custom emoji
    emojiName = emoji.name ?? "unknown";
    discordEmojiId = emoji.id;
    isAnimated = emoji.animated ?? false;
    emojiId = emoji.name ?? undefined;
    emojiUrl = emoji.imageURL() ?? undefined;
  } else {
    // This is a native emoji
    emojiChar = emoji.name || undefined; // Emoji itself for native emojis
    emojiId = emoji.name || undefined;
  }

  const dbEmoji = await prisma.emoji.upsert({
    where: { id: emojiId || "unknown" },
    update: {
      name: emojiName,
      emojiChar: emojiChar,
      isAnimated: isAnimated,
      discordId: discordEmojiId,
      url: emojiUrl,
    },
    create: {
      id: emojiId || "unknown",
      name: emojiName,
      emojiChar: emojiChar,
      discordId: discordEmojiId,
      isAnimated: isAnimated,
      url: emojiUrl,
    },
  });

  return dbEmoji;
};

export async function findEmojiPaymentRule(
  emojiId: string,
): Promise<PaymentRule | null> {
  return await prisma.paymentRule.findUnique({
    where: { emojiId: emojiId },
  });
}

export async function findEmojiCategoryRule(
  emojiId: string,
): Promise<(CategoryRule & { category: Category }) | null> {
  return await prisma.categoryRule.findUnique({
    where: { emojiId: emojiId },
    include: { category: true },
  });
}

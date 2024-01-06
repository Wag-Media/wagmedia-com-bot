import { PrismaClient } from "@prisma/client";
import { GuildEmoji, MessageReaction, ReactionEmoji } from "discord.js";
const prisma = new PrismaClient();

export const findOrCreateEmoji = async (emoji: GuildEmoji | ReactionEmoji) => {
  let emojiName: string | undefined;
  let emojiChar: string | undefined;
  let discordEmojiId: string | undefined;
  let isAnimated: boolean | undefined;

  if (emoji.id) {
    // This is a custom emoji
    emojiName = emoji.name ?? "unknown";
    discordEmojiId = emoji.id;
    isAnimated = emoji.animated ?? false;
  } else {
    // This is a native emoji
    emojiChar = emoji.name || undefined; // Emoji itself for native emojis
  }

  console.log("will create this emoji", {
    id: emoji.id || emoji.name!,
    name: emoji.name!,
  });

  const dbEmoji = await prisma.emoji.upsert({
    where: { discordId: discordEmojiId ?? emojiChar },
    update: {
      name: emojiName,
      emojiChar: emojiChar,
      isAnimated: isAnimated,
    },
    create: {
      id: emoji.id || emoji.name!,
      name: emojiName,
      emojiChar: emojiChar,
      discordId: discordEmojiId,
      isAnimated: isAnimated,
    },
  });

  return dbEmoji;
};

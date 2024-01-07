import { EmojiAction } from "@/config.js";
import { findOrCreateEmoji } from "@/data/emoji.js";
import { findOrCreatePost } from "@/data/post.js";
import { findOrCreateUser } from "@/data/user.js";
import { PrismaClient, User } from "@prisma/client";
import { Emoji, MessageReaction, User as DiscordUser } from "discord.js";

const prisma = new PrismaClient();

export async function handleReaction(
  reaction: MessageReaction,
  user: DiscordUser
) {
  // Ensure related records exist
  console.log("reaction.emoji", reaction.emoji);
  let emojiIdentifier = reaction.emoji.id || reaction.emoji.name; // Handle both custom and Unicode emojis
  console.log("emojiIdentifier", emojiIdentifier);

  if (!emojiIdentifier) {
    throw new Error("No emoji found in the reaction");
  }

  try {
    // ensure User exists
    const user = await findOrCreateUser(reaction.message);

    // ensure Post exists
    const post = await findOrCreatePost(reaction.message);

    // ensure Emoji exists
    const emoji = await findOrCreateEmoji(reaction.emoji);

    // upsert PostReaction
    await prisma.reaction.upsert({
      where: {
        postId_userDiscordId_emojiId: {
          postId: post.id,
          emojiId: emoji.id,
          userDiscordId: user.discordId,
        },
      },
      update: {},
      create: {
        postId: post.id,
        emojiId: emoji.id,
        userDiscordId: user.discordId,
      },
    });

    const emojiAction = emoji.action;
    if (emojiAction) {
      performEmojiAction(emojiAction, reaction, user);
    }
  } catch (error) {
    console.error("Error processing reaction:", error);
  }
}

function isValidAction(action: string): action is EmojiAction {
  return Object.values(action).includes(action as EmojiAction);
}

function performEmojiAction(
  action: string,
  reaction: MessageReaction,
  user: User
) {
  if (!isValidAction(action)) {
    console.error(`Invalid action: ${action}`);
    return;
  }

  switch (action) {
    case EmojiAction.publish:
      console.log("post published");
      break;
    case EmojiAction.addCategory:
      console.log("added category");
      break;
    default:
      console.error(`Invalid action: ${action}`);
  }
}

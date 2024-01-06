import { findOrCreateEmoji } from "@/data/emoji.js";
import { findOrCreatePost } from "@/data/post.js";
import { findOrCreateUser } from "@/data/user.js";
import { PrismaClient } from "@prisma/client";
import { MessageReaction, User } from "discord.js";

const prisma = new PrismaClient();

export async function handleReaction(reaction: MessageReaction, user: User) {
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
    console.log("user found", user);

    // ensure Post exists
    const post = await findOrCreatePost(reaction.message);
    console.log("post found", post);

    // ensure Emoji exists
    const emoji = await findOrCreateEmoji(reaction.emoji);

    // upsert PostReaction
    await prisma.reaction.upsert({
      where: {
        postId_userDiscordId_emojiId: {
          postId: reaction.message.id,
          emojiId: emojiIdentifier,
          userDiscordId: user.discordId,
        },
      },
      update: {},
      create: {
        postId: reaction.message.id,
        emojiId: emojiIdentifier,
        userDiscordId: user.discordId,
      },
    });
  } catch (error) {
    console.error("Error processing reaction:", error);
  }
}

function performEmojiAction(
  action: string,
  reaction: MessageReaction,
  user: User
) {
  // Define your logic here based on the action string
  console.log(
    `Performing action: ${action} for user ${user.id} on message ${reaction.message.id}`
  );
  // Example: if (action === 'like') { /* ... */ }
}

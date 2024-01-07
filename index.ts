import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { client } from "./utils/discord.js";
import * as config from "./config.js";
import { Emoji, MessageReaction, User } from "discord.js";
import { parseMessage } from "./utils/parse-message.js";
import { PrismaClient } from "@prisma/client";
import { findOrCreateUser } from "./data/user.js";
import { findOrCreateEmoji } from "./data/emoji.js";
import { findOrCreatePost } from "./data/post.js";
import { handleReaction } from "./handlers/handleReaction.js";

//store your token in environment variable or put it here
const token = process.env["TOKEN"];
const prisma = new PrismaClient();

client.on("ready", () => {
  console.log(`Logged in as ${client.user?.tag}!`);

  dfp.start({
    client,
    load: ["./commands"],
  });
});

client.on("error", console.error);
client.on("warn", console.warn);
client.on("disconnect", () => {
  console.info("Disconnected from discord.");
});
client.on("reconnecting", () => {
  console.info("Reconnecting to discord.");
});

client.on("messageCreate", async (message) => {
  if (config.CHANNELS_TO_MONITOR.includes(message.channel.id)) {
    console.log(`✉️  New message in the channel`);
    console.log(`  ↪ user: ${JSON.stringify(message.member)}`);
    const { title, description, tags } = parseMessage(message.content);
    console.log(`  ↪ title: ${title}`);
    console.log(`  ↪ description: ${description}`);
    console.log(`  ↪ tags: ${tags}`);
    console.log(`  ↪ avatar: ${message.member?.displayAvatarURL()}`);

    console.log(
      `checking if all good, ${title}, ${description}, ${tags.length}`
    );

    // Check if the message contains necessary information
    if (title && description && tags.length > 0) {
      // Upsert the user (create if not exists, else skip creation)
      const user = await findOrCreateUser(message);

      console.log("all title tags description", title, tags, description);

      // Create a new post
      await prisma.post.create({
        data: {
          id: message.id,
          title,
          content: message.content,
          userId: user.id, // use the discordId from the upserted user
          published: false,
          // Include logic to add categories and hashtags if applicable
        },
      });
    }
  }
});

client.on(
  "messageReactionAdd",
  async (reaction: MessageReaction, user: User) => {
    // Check if the reaction is in the channel we are interested in
    if (config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id)) {
      if (user.bot) return; // Ignore bot reactions

      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch (error) {
          console.error(
            "Something went wrong when fetching the reaction:",
            error
          );
          return;
        }
      }

      if (reaction.message.partial) {
        try {
          await reaction.message.fetch();
        } catch (error) {
          console.error(
            "Something went wrong when fetching the message:",
            error
          );
          return;
        }
      }

      await handleReaction(reaction, user);

      // Check if the emoji is the one you're looking for
      if (true) {
        //   if (reaction.emoji.name === "SPECIFIC_EMOJI_NAME") {
        // Check if the user who reacted has the specific role
        const member = await reaction.message.guild?.members.fetch(user.id);
        console.log(`✅ new emoji: ${JSON.stringify(reaction.emoji)}`);
        console.log(
          `  ↪ member ${
            member?.displayName
          } has director role: ${member?.roles.cache.some(
            (role) => role.name === "Director"
          )}`
        );
        console.log(`  ↪ member ${JSON.stringify(member)}`);
        if (
          member?.roles.cache.some((role) => role.name === "SPECIFIC_ROLE_NAME")
        ) {
          console.log(`User with specific role reacted with specific emoji`);
          // Add your logic to insert the post into the database
        }
      }
    }
  }
);

client.on(
  "messageReactionRemove",
  async (reaction: MessageReaction, user: User) => {
    if (reaction.message.partial) await reaction.message.fetch(); // If the message is not cached
    if (reaction.partial) await reaction.fetch(); // If the reaction is not cached
    if (user.bot) return; // Ignore bot reactions

    // try {
    //   await prisma.postReaction.delete({
    //     where: {
    //       postId_emojiId_reactorId: {
    //         postId: reaction.message.id,
    //         emojiId: reaction.emoji.id || reaction.emoji.name!, // If custom emoji, use ID, otherwise use name
    //         reactorId: user.id,
    //       },
    //     },
    //   });
    // } catch (error) {
    //   console.error("Error removing post reaction:", error);
    // }
  }
);

client.login(token);

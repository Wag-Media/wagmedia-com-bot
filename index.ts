import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { client } from "./utils/discord.js";
import * as config from "./config.js";
import { MessageReaction, User } from "discord.js";
import { parseMessage } from "./utils/parse-message.js";
import { PrismaClient } from "@prisma/client";

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

client.on("messageCreate", async (message) => {
  if (config.CHANNELS_TO_MONITOR.includes(message.channel.id)) {
    console.log(`✉️  New message in the channel`);
    console.log(`  ↪ user: ${JSON.stringify(message.member)}`);
    const { title, description, tags } = parseMessage(message.content);
    console.log(`  ↪ title: ${title}`);
    console.log(`  ↪ description: ${description}`);
    console.log(`  ↪ tags: ${tags}`);
    console.log(`  ↪ avatar: ${message.member?.displayAvatarURL()}`);

    // Check if the message contains necessary information
    if (title && description && tags.length > 0) {
      // Upsert the user (create if not exists, else skip creation)
      const user = await prisma.user.upsert({
        where: {
          discordId: message.author.id,
        },
        update: {
          // Update the avatar every time the user posts something
          avatar: message.member?.displayAvatarURL(),
          name: message.member?.displayName,
        },
        create: {
          discordId: message.author.id,
          avatar: message.member?.displayAvatarURL(),
          name: message.member?.displayName,
        },
      });

      // Create a new post
      await prisma.post.create({
        data: {
          content: message.content,
          authorId: user.discordId, // use the discordId from the upserted user
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
    // Check if the reaction is in the channel you're interested in
    if (config.CHANNELS_TO_MONITOR.includes(reaction.message.channel.id)) {
      // Check if the emoji is the one you're looking for
      if (true) {
        //   if (reaction.emoji.name === "SPECIFIC_EMOJI_NAME") {
        // Check if the user who reacted has the specific role
        const member = await reaction.message.guild?.members.fetch(user.id);
        console.log(`✅ new emoji: ${reaction.emoji.name}`);
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

client.login(token);

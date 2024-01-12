import "dotenv/config";
import { dfp } from "./utils/dfp.js";
import { client } from "./utils/discord.js";
import * as config from "./config.js";
import { Emoji, MessageReaction, User } from "discord.js";

import { PrismaClient } from "@prisma/client";

import { handleMessageCreate } from "./handlers/handleMessageCreate.js";
import { handleMessageReactionAdd } from "./handlers/handleMessageReactionAdd.js";

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

client.on("messageCreate", handleMessageCreate);

client.on("messageReactionAdd", handleMessageReactionAdd);

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

import { parseMessage } from "@/utils/parse-message";
import * as config from "../config";
import { findOrCreateUser } from "@/data/user";
import { PrismaClient } from "@prisma/client";
import { logger } from "@/client";

const prisma = new PrismaClient();

export async function handleMessageCreate(message) {
  if (config.CHANNELS_TO_MONITOR.includes(message.channel.id)) {
    const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;
    const { title, description, tags } = parseMessage(message.content);

    // Check if the message contains necessary information
    if (title && description) {
      logger.log(`New relevant message in the channel ${messageLink}`);
      logger.log(`↪ user: ${message.member?.displayName}`);
      logger.log(`↪ title: ${title}`);
      logger.log(`↪ description: ${description}`);
      logger.log(`↪ tags: ${tags}`);

      // Upsert the user (create if not exists, else skip creation)
      const user = await findOrCreateUser(message);

      // Create a new post
      await prisma.post.create({
        data: {
          id: message.id,
          title,
          content: message.content,
          userId: user.id, // use the discordId from the upserted user
        },
      });
    }
  }
}

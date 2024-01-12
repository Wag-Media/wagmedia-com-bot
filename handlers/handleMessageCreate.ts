import { parseMessage } from "@/utils/parse-message";
import * as config from "../config";
import { findOrCreateUser } from "@/data/user";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function handleMessageCreate(message) {
  if (config.CHANNELS_TO_MONITOR.includes(message.channel.id)) {
    console.log(`✉️  New message in the channel`);
    console.log(`  ↪ user: ${JSON.stringify(message.member)}`);
    const { title, description, tags } = parseMessage(message.content);
    console.log(`  ↪ title: ${title}`);
    console.log(`  ↪ description: ${description}`);
    console.log(`  ↪ tags: ${tags}`);
    console.log(`  ↪ avatar: ${message.member?.displayAvatarURL()}`);

    // Check if the message contains necessary information
    if (title && description) {
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

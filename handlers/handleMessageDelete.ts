import { Message, PartialMessage } from "discord.js";
import { ensureFullMessage } from "./util";
import { prisma } from "@/utils/prisma";
import { logger } from "@/client";
import { Post } from "@prisma/client";

export async function handleMessageDelete(
  message: Message<boolean> | PartialMessage
) {
  message = await ensureFullMessage(message);
  const channelLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}`;

  const post = await prisma.post.findUnique({
    where: { id: message.id },
  });

  if (post) {
    if (post.isPublished) {
      logger.warn(`A published post was deleted in the channel ${channelLink}`);
      message.author.send(
        `Uh oh, your published post in ${channelLink} was just deleted. Please contact a moderator if you think this was a mistake.`
      );
    } else {
      logger.log(
        `A post that was not yet published was deleted in the channel ${channelLink}`
      );
    }

    await prisma.post.update({
      where: { id: message.id },
      data: { isDeleted: true },
    });
  }
}

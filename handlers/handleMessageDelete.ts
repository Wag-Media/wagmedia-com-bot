import { Message, PartialMessage } from "discord.js";
import { prisma } from "@/utils/prisma";
import { logger } from "@/client";
import { determineContentType } from "../curators/utils";

export async function handleMessageDelete(
  message: Message<boolean> | PartialMessage,
) {
  // message = await ensureFullMessage(message);
  const channelLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}`;

  const contentType = determineContentType(message);

  const post = await prisma.post.findUnique({
    where: { id: message.id },
  });

  if (post) {
    if (post.isPublished) {
      logger.warn(`[post] A published post was deleted in ${channelLink}`);
      message.author &&
        message.author.send(
          `Uh oh, your published post in ${channelLink} was just deleted. Please contact a moderator if you think this was a mistake.`,
        );
      await prisma.post.update({
        where: { id: message.id },
        data: { isDeleted: true },
      });
    } else {
      logger.log(
        `[post] A post that was not yet published was deleted in  ${channelLink}`,
      );
      await prisma.post.delete({ where: { id: message.id } });
    }

    return;
  }

  const oddJob = await prisma.oddJob.findUnique({
    where: { id: message.id },
    include: { payments: true },
  });

  if (oddJob) {
    if (oddJob.payments.length > 0) {
      logger.warn(`[oddjob] A paid oddJob was deleted in ${channelLink}`);
      message.author &&
        message.author.send(
          `Uh oh, your paid odd job in ${channelLink} was just deleted. Please contact a moderator if you think this was a mistake.`,
        );
      await prisma.oddJob.update({
        where: { id: message.id },
        data: { isDeleted: true },
      });
    } else {
      logger.log(
        `[oddjob] An oddjob that was not yet published was deleted in ${channelLink}`,
      );
      await prisma.oddJob.delete({ where: { id: message.id } });
    }
  }
}

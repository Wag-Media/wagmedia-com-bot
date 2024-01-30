import {
  Category,
  OddJob,
  Post,
  PostEarnings,
  PrismaClient,
  Tag,
} from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser, findOrCreateUserById } from "./user.js";
import { parseMessage } from "@/utils/parse-message.js";
import { logger } from "@/client.js";
import { slugify } from "@/handlers/util.js";
const prisma = new PrismaClient();

// id              String    @id
// role            String
// description     String
// timeline        String
// requestedAmount Float
// requestedUnit   String
// payments        Payment[]
// manager         String

// discordLink String? // Discord link to the original post, if applicable

// createdAt DateTime @default(now())
// updatedAt DateTime @updatedAt

export async function findOrCreateOddJob(
  message: Message<boolean> | PartialMessage,
  messageLink: string,
  role: string,
  description: string,
  timeline: string,
  requestedAmount: number,
  requestedUnit: string,
  managerId: string
): Promise<OddJob> {
  const user = await findOrCreateUser(message);
  const manager = await findOrCreateUserById(managerId);

  return prisma.oddJob.upsert({
    where: { id: message.id },
    update: {
      description,
      discordLink: messageLink,
      timeline,
      role,
      requestedAmount,
      requestedUnit,
      managerId: manager.discordId,
    },
    create: {
      id: message.id,
      description,
      discordLink: messageLink,
      timeline,
      role,
      requestedAmount,
      requestedUnit,
      userId: user.discordId,
      managerId: manager.discordId,
    },
    include: {
      payments: true,
    },
  });
}

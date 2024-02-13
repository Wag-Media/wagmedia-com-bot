import { ContentEarnings, OddJob, Payment, PrismaClient } from "@prisma/client";
import { Message, MessageReaction, PartialMessage, User } from "discord.js";
import { findOrCreateUser, findOrCreateUserFromDiscordUser } from "./user.js";
import { logger } from "@/client.js";
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
  manager: User
): Promise<OddJob> {
  const user = await findOrCreateUser(message);
  const managerInDb = await findOrCreateUserFromDiscordUser(manager);

  return prisma.oddJob.upsert({
    where: { id: message.id },
    update: {
      description,
      discordLink: messageLink,
      timeline,
      role,
      requestedAmount,
      requestedUnit,
      managerId: managerInDb.discordId,
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
      managerId: managerInDb.discordId,
    },
    include: {
      payments: true,
    },
  });
}

export async function fetchOddjob(
  reaction: MessageReaction
): Promise<
  (OddJob & { payments: Payment[]; earnings: ContentEarnings[] }) | null
> {
  if (!reaction.message.id) {
    throw new Error("Message must have an id");
  }
  if (!reaction.message.content) {
    throw new Error("Message must have content");
  }

  const oddjob = await prisma.oddJob.findUnique({
    where: { id: reaction.message.id },
    include: { payments: true, earnings: true },
  });

  if (!oddjob) {
    logger.warn(
      `Post with ID ${reaction.message.id} not found in the database.`
    );
  }
  return oddjob;
}

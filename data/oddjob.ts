import {
  ContentEarnings,
  Emoji,
  OddJob,
  Payment,
  PrismaClient,
} from "@prisma/client";
import { Message, MessageReaction, PartialMessage, User } from "discord.js";
import { findOrCreateUser, findOrCreateUserFromDiscordUser } from "@/data/user";
import { logger } from "@/client";
import { OddjobWithEarnings } from "@/types";
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
  manager: User,
): Promise<OddjobWithEarnings> {
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
      earnings: true,
    },
  });
}

/**
 * Upsert an oddjob reaction
 * @param oddjob
 * @param dbUser
 * @param emoji
 * @returns
 */
export async function upsertOddjobReaction(
  oddjob: OddJob,
  dbUser: User,
  dbEmoji: Emoji,
) {
  const dbReaction = await prisma.reaction.upsert({
    where: {
      oddJobId_userDiscordId_emojiId: {
        oddJobId: oddjob.id,
        emojiId: dbEmoji.id,
        userDiscordId: dbUser.id,
      },
    },
    update: {},
    create: {
      oddJobId: oddjob.id,
      emojiId: dbEmoji.id,
      userDiscordId: dbUser.id,
    },
  });

  if (!dbReaction) {
    throw new Error("Reaction could not be upserted");
  }
  return dbReaction;
}

export async function getOddJob(id: string): Promise<OddJob | null> {
  return prisma.oddJob.findUnique({
    where: { id },
  });
}

export async function oddJobHasEarnings(oddJobId: string): Promise<boolean> {
  const earnings = await prisma.contentEarnings.findMany({
    where: { oddJobId },
  });

  return earnings.length > 0;
}

export async function getOddjobWithEarnings(
  oddJobId: string,
): Promise<OddjobWithEarnings | null> {
  const oddjob = await prisma.oddJob.findUnique({
    where: { id: oddJobId },
    include: { earnings: true },
  });

  if (!oddjob) {
    logger.warn(
      `[oddjob] Oddjob with ID ${oddJobId} not found in the database.`,
    );
  }
  return oddjob;
}

export async function fetchOddjob(
  reaction: MessageReaction,
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
      `[oddjob] Oddjob with ID ${reaction.message.id} not found in the database.`,
    );
  }
  return oddjob;
}

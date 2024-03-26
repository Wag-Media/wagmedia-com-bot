import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getLastProcessedTimestamp() {
  const lastProcessed = await prisma.lastProcessedPost.findFirst({
    orderBy: {
      updatedAt: "desc", // Order by updatedAt in descending order
    },
    select: {
      updatedAt: true, // Select only the updatedAt field
    },
  });

  return lastProcessed ? lastProcessed.updatedAt : null;
}

export async function upsertLastProcessedPost(
  channelId: string,
  postId: string,
) {
  await prisma.lastProcessedPost.upsert({
    where: {
      channelId: channelId, // Unique identifier to search for an existing record
    },
    update: {
      postId: postId, // Update the postId if the record exists
    },
    create: {
      channelId: channelId,
      postId: postId, // Create a new record with these details if it doesn't exist
    },
  });
}

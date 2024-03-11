import {
  Category,
  ContentEarnings,
  Embed,
  OddJob,
  Post,
  PrismaClient,
  Tag,
} from "@prisma/client";
import { Message, MessageReaction, PartialMessage } from "discord.js";
import { findOrCreateUser } from "@/data/user";
import { logger } from "@/client";
import { slugify } from "@/handlers/util";
import {
  PostEmbed,
  PostWithCategories,
  PostWithCategoriesTagsEmbeds,
  PostWithEarnings,
} from "@/types";
const prisma = new PrismaClient();

export type PostCreateType = {
  message: Message<boolean> | PartialMessage;
  title: string;
  description: string;
  tags: string[];
  embeds: PostEmbed[];
  parentId?: string;
};

export const findOrCreatePost = async (
  attributes: PostCreateType
): Promise<PostWithCategoriesTagsEmbeds> => {
  const { message, title, description, tags, embeds } = attributes;

  if (!message) {
    throw new Error("Message must be defined");
  }
  if (!message.id) {
    throw new Error("Message must have an id");
  }
  if (!message.content) {
    throw new Error("Message must have content");
  }

  const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;

  const user = await findOrCreateUser(message);

  // Ensure all tags exist
  const tagInstances = await Promise.all(
    tags.map(async (tag) => {
      return prisma.tag.upsert({
        where: { name: tag },
        update: {},
        create: {
          name: tag,
        },
      });
    })
  );

  // Upsert the post
  const post = await prisma.post.upsert({
    where: { id: message.id },
    update: {
      title,
      content: description,
      discordLink: messageLink,
      slug: slugify(title),
      isDeleted: false,
      // Update tags connection
      tags: {
        set: [], // Disconnect any existing tags
        connect: tagInstances.map((tag) => ({ id: tag.id })), // Connect new tags
      },
    },
    create: {
      id: message.id,
      title,
      content: description,
      discordLink: messageLink,
      slug: slugify(title),
      userId: user.id, // Assuming you have the user's ID
      tags: {
        connect: tagInstances.map((tag) => ({ id: tag.id })),
      },
    },
    include: {
      categories: true,
      tags: true, // Include tags in the returned object for verification
      embeds: true,
    },
  });

  const createdEmbeds = await _manageEmbedsForPost(post.id, embeds);

  return {
    ...post,
    embeds: createdEmbeds,
  };
};

async function _manageEmbedsForPost(
  postId: string,
  embeds: PostEmbed[]
): Promise<Embed[]> {
  // Delete existing embeds - assuming this is still the desired behavior
  await prisma.embed.deleteMany({
    where: { postId: postId },
  });

  // Create new embeds and return the complete objects
  const createdEmbeds = await Promise.all(
    embeds.map((embed) =>
      prisma.embed.create({
        data: {
          embedUrl: embed.url,
          embedImage: embed.imageUrl,
          embedColor: embed.color,
          postId: postId,
        },
      })
    )
  );

  return createdEmbeds;
}

/**
 * Threads are just posts with a parentId
 * @param message
 * @param content
 * @param url
 * @returns
 */
export async function findOrCreateThreadPost(attributes: {
  message: Message<boolean> | PartialMessage;
  content: string;
  url: string;
}): Promise<Post & { categories: Category[] & Tag[] }> {
  const { message, content, url } = attributes;
  const threadPost = findOrCreatePost({
    message,
    title: "Thread",
    description: content,
    tags: [],
    embeds: [],
    parentId: message.channel.id,
  });
  return threadPost;
}

export async function getPostReactionCount(postId: string) {
  const count = await prisma.reaction.count({
    where: {
      postId: postId,
    },
  });

  return count;
}

export async function getPostOrOddjobReactionCount(
  entityId: string,
  entityType: "post" | "oddjob" | undefined
) {
  if (!entityType) {
    return;
  }

  const whereCondition =
    entityType === "post" ? { postId: entityId } : { oddJobId: entityId };

  const count = await prisma.reaction.count({
    where: whereCondition,
  });

  return count;
}

export async function fetchPost(
  reaction: MessageReaction
): Promise<
  (Post & { categories: Category[] } & { earnings: ContentEarnings[] }) | null
> {
  if (!reaction.message.id) {
    throw new Error("Message must have an id");
  }
  if (!reaction.message.content) {
    throw new Error("Message must have content");
  }

  const post = await prisma.post.findUnique({
    where: { id: reaction.message.id },
    include: { categories: true, earnings: true },
  });

  if (!post) {
    logger.warn(
      `[post] Post with ID ${reaction.message.id} not found in the database.`
    );
  }
  return post;
}

export async function removeCategoryFromPost(
  postId: string,
  categoryId: number
) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      categories: {
        disconnect: [{ id: categoryId }],
      },
    },
  });

  return post;
}

export async function removeReactionFromPost(
  postId: string,
  userId: string,
  emojiId: string
) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      reactions: {
        delete: {
          postId_userDiscordId_emojiId: {
            postId,
            emojiId,
            userDiscordId: userId,
          },
        },
      },
    },
  });

  return post;
}

export async function unpublishPost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isPublished: false,
    },
  });

  return post;
}

export async function flagDeletePost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isDeleted: true,
    },
  });

  return post;
}

export async function getPost(
  postId: string
): Promise<PostWithCategories | null> {
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      categories: true,
    },
  });

  return post;
}

export async function getPostWithEarnings(
  postId: string
): Promise<PostWithEarnings | null> {
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      earnings: true,
    },
  });

  return post;
}

export async function addCategory(postId: string, categoryId: number) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    include: {
      categories: true,
    },
    data: {
      categories: {
        connect: [{ id: categoryId }],
      },
    },
  });

  return post;
}

export async function resetPostReactions(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      reactions: {
        deleteMany: {},
      },
      payments: {
        deleteMany: {},
      },
      earnings: {
        deleteMany: {},
      },
      categories: {
        connect: [],
      },
    },
  });

  return post;
}

export async function resetPostOrOddjobReactions(
  entityId: string,
  entityType: "oddjob" | "post" | undefined
): Promise<Post | OddJob | null | undefined> {
  if (!entityType) {
    return;
  }

  if (entityType === "post") {
    return prisma.post.update({
      where: {
        id: entityId,
      },
      data: {
        reactions: {
          deleteMany: {},
        },
        payments: {
          deleteMany: {},
        },
        earnings: {
          deleteMany: {},
        },
        categories: {
          connect: [],
        },
      },
    });
  } else {
    return prisma.oddJob.update({
      where: {
        id: entityId,
      },
      data: {
        reactions: {
          deleteMany: {},
        },
        payments: {
          deleteMany: {},
        },
        earnings: {
          deleteMany: {},
        },
      },
    });
  }
}

export async function featurePost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isFeatured: true,
    },
  });

  return post;
}

export async function unfeaturePost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isFeatured: false,
    },
  });

  return post;
}

export async function getPostOrOddjob(
  entityId: string,
  entityType: "post" | "oddjob" | undefined
): Promise<PostWithCategories | OddJob | null | undefined> {
  if (!entityType) {
    return;
  }

  if (entityType === "post") {
    return prisma.post.findUnique({
      where: {
        id: entityId,
      },
      include: {
        categories: true,
      },
    });
  } else {
    return prisma.oddJob.findUnique({
      where: {
        id: entityId,
      },
    });
  }
}

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
  ContentType,
  OddjobWithEarnings,
  PostEmbed,
  PostFull,
  PostWithCategories,
  PostWithCategoriesEarnings,
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
  attributes: PostCreateType,
): Promise<PostFull> => {
  const { message, title, description, tags, embeds, parentId } = attributes;

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

  const contentType = determinePostType(messageLink);

  console.log("aaa contentType", contentType);

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
    }),
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
      parentPostId: parentId,
      // Update tags connection
      tags: {
        set: [], // Disconnect any existing tags
        connect: tagInstances.map((tag) => ({ id: tag.id })), // Connect new tags
      },
      contentType,
    },
    create: {
      id: message.id,
      title,
      content: description,
      discordLink: messageLink,
      slug: slugify(title),
      userId: user.id, // Assuming you have the user's ID
      parentPostId: parentId,
      tags: {
        connect: tagInstances.map((tag) => ({ id: tag.id })),
      },
      isPublished: false,
      isDeleted: false,
      isFeatured: false,
      contentType,
    },
    include: {
      categories: true,
      tags: true, // Include tags in the returned object for verification
      embeds: true,
      earnings: true,
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
  embeds: PostEmbed[],
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
      }),
    ),
  );

  return createdEmbeds;
}

/**
 * Threads are just posts with a parentId and no specific other fields
 * @param message
 * @param content
 * @param url
 * @returns
 */
export async function findOrCreateThreadPost(attributes: {
  message: Message<boolean> | PartialMessage;
  content: string;
  url: string;
}): Promise<PostWithEarnings> {
  const { message, content, url } = attributes;

  const parentId = message.channel.isThread()
    ? message.channel.parent!.id
    : undefined;
  console.log("findOrCreateThreadPost parentId", parentId);

  const threadPost = findOrCreatePost({
    message,
    title: "Thread",
    description: content,
    tags: [],
    embeds: [],
    parentId,
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
  contentId: string,
  contentType: ContentType,
) {
  if (!contentType) {
    return;
  }

  if (!["newsletter", "oddjob", "post", "thread"].includes(contentType)) {
    logger.warn(
      `Invalid contentType ${contentType} in getPostOrOddjobReactionCount. Skipping.`,
    );
    return;
  }

  const whereCondition =
    contentType === "post" ||
    contentType === "thread" ||
    contentType === "newsletter"
      ? { postId: contentId }
      : { oddJobId: contentId };

  const count = await prisma.reaction.count({
    where: whereCondition,
  });

  return count;
}

export async function fetchPost(
  reaction: MessageReaction,
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
      `[post] Post with ID ${reaction.message.id} not found in the database.`,
    );
  }
  return post;
}

export async function removeCategoryFromPost(
  postId: string,
  categoryId: number,
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
  emojiId: string,
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

export async function publishPost(postId: string) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    data: {
      isPublished: true,
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
  postId: string,
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
  postId: string,
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

export async function getAllCategories(): Promise<Category[]> {
  const categories = await prisma.category.findMany();

  return categories;
}

export async function setCategory(postId: string, categoryId: number) {
  const post = await prisma.post.update({
    where: {
      id: postId,
    },
    include: {
      categories: true,
    },
    data: {
      categories: {
        set: [{ id: categoryId }],
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
): Promise<Post | OddJob | null | undefined> {
  const post = await prisma.post.findUnique({
    where: {
      id: entityId,
    },
  });

  if (post) {
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
  }

  const oddJob = await prisma.oddJob.findUnique({
    where: {
      id: entityId,
    },
  });

  if (oddJob) {
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

  return null;
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
  entityType: ContentType,
): Promise<PostWithCategories | OddJob | null | undefined> {
  if (!entityType) {
    return;
  }

  if (
    entityType === "post" ||
    entityType === "thread" ||
    entityType === "newsletter"
  ) {
    return prisma.post.findUnique({
      where: {
        id: entityId,
      },
      include: {
        categories: true,
      },
    });
  } else if (entityType === "oddjob") {
    return prisma.oddJob.findUnique({
      where: {
        id: entityId,
      },
    });
  } else {
    logger.warn(
      `Invalid entityType ${entityType} in getPostOrOddjob. Skipping.`,
    );
    return;
  }
}

export async function getPostOrOddjobWithEarnings(
  entityId: string,
  entityType: ContentType,
): Promise<PostWithEarnings | OddjobWithEarnings | null | undefined> {
  if (!entityType) {
    return;
  }

  if (entityType === "post" || entityType === "thread") {
    return prisma.post.findUnique({
      where: {
        id: entityId,
      },
      include: {
        earnings: true,
      },
    });
  } else {
    return prisma.oddJob.findUnique({
      where: {
        id: entityId,
      },
      include: {
        earnings: true,
      },
    });
  }
}

export async function postHasCategory(postId: string, categoryName: string) {
  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      categories: true,
    },
  });

  if (!post) {
    return false;
  }

  return post.categories.some((category) => category.name === categoryName);
}

export function determinePostType(
  messageLink: string,
): "article" | "news" | undefined {
  const channelNewsIds = JSON.parse(process.env.CHANNELS_NEWS || "[]");
  const channelArticleIds = JSON.parse(process.env.CHANNELS_ARTICLES || "[]");

  for (const channelId of channelNewsIds) {
    if (messageLink.includes(channelId)) {
      return "news";
    }
  }

  for (const channelId of channelArticleIds) {
    if (messageLink.includes(channelId)) {
      return "article";
    }
  }
}

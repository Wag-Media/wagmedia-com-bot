import {
  getGuildFromMessage,
  isCategoryMonitoredForPosts,
  isChannelMonitoredForEvents,
  isChannelMonitoredForNewsletter,
  isChannelMonitoredForOddJobs,
  isChannelMonitoredForPosts,
} from "@/handlers/util";
import { ContentType, EmojiType, UserRole } from "@/types";
import { userHasRole } from "@/utils/userHasRole";
import {
  Message,
  PartialMessage,
  User as DiscordUser,
  MessageReaction,
} from "discord.js";

import * as config from "@/config";
import {
  findEmoji,
  findEmojiCategoryRule,
  findEmojiPaymentRule,
} from "@/data/emoji";
import { PaymentRule } from "@prisma/client";
import { findFirstPayment } from "@/data/payment";

export function determineContentType(message: Message | PartialMessage): {
  contentType: ContentType;
  parentId?: string;
} {
  let parentChannel, parentId;
  let contentType: ContentType;

  if (message.channel.isThread()) {
    parentChannel = message.channel.parent;
    parentId = message.channelId;
  }

  if (parentId) {
    if (
      isCategoryMonitoredForPosts(parentChannel) ||
      isChannelMonitoredForPosts(parentChannel) ||
      isChannelMonitoredForNewsletter(parentChannel)
    ) {
      contentType = "thread";
    }
  } else {
    if (
      isChannelMonitoredForPosts(message.channel) ||
      isCategoryMonitoredForPosts(message.channel)
    ) {
      contentType = "post";
    } else if (isChannelMonitoredForOddJobs(message.channel)) {
      contentType = "oddjob";
    } else if (isChannelMonitoredForNewsletter(message.channel)) {
      contentType = "newsletter";
    } else if (isChannelMonitoredForEvents(message.channel)) {
      contentType = "event";
    }
  }

  return {
    contentType,
    parentId,
  };
}

export async function determineUserRole(
  message: Message,
  user: DiscordUser,
): Promise<UserRole> {
  const guild = await getGuildFromMessage(message);

  if (await userHasRole(guild, user, config.ROLES_WITH_POWER)) {
    return "superuser";
  }

  return "regular";
}

export async function determineEmojiType(
  reaction: MessageReaction,
): Promise<EmojiType> {
  const dbEmoji = await findEmoji(reaction.emoji);

  if (!dbEmoji) {
    return "regular";
  }

  // 1. Check for Feature Rule
  if (dbEmoji.name === config.FEATURE_EMOJI) {
    return "feature";
  }

  // 2. Check for Universal Publish Emoji
  if (dbEmoji.name === config.UNIVERSAL_PUBLISH_EMOJI) {
    return "universalPublish";
  }

  // 3. Check for Category Rule
  const categoryRule = await findEmojiCategoryRule(dbEmoji.id);
  if (categoryRule) {
    return "category";
  }

  // 4. Check for Payment Rule
  const paymentRule = await findEmojiPaymentRule(dbEmoji.id);
  if (paymentRule) {
    return "payment";
  }

  return "regular";
}

export async function isPaymentUnitValid(
  dbContentId: string,
  contentType: ContentType,
  paymentRule: PaymentRule | null,
): Promise<boolean> {
  if (!paymentRule) {
    return false;
  }

  const paymentCondition =
    contentType === "post" || contentType === "thread"
      ? { postId: dbContentId }
      : { oddJobId: dbContentId };

  const firstPayment = await findFirstPayment(paymentCondition);

  if (!firstPayment || !firstPayment.reaction) {
    return true;
  }

  return (
    paymentRule.paymentUnit === firstPayment.unit &&
    paymentRule.fundingSource === firstPayment.fundingSource
  );
}

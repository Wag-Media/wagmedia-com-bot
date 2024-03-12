import {
  getGuildFromMessage,
  isCategoryMonitoredForPosts,
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
      isChannelMonitoredForPosts(parentChannel)
    ) {
      contentType = "thread";
    }
  } else {
    if (isChannelMonitoredForPosts(message.channel)) {
      contentType = "post";
    } else if (isChannelMonitoredForOddJobs(message.channel)) {
      contentType = "oddjob";
    }
  }

  return {
    contentType,
    parentId,
  };
}

export async function determineUserRole(
  message: Message,
  user: DiscordUser
): Promise<UserRole> {
  const guild = await getGuildFromMessage(message);

  if (userHasRole(guild, user, config.ROLES_WITH_POWER)) {
    return "superuser";
  }

  return "regular";
}

export async function determineEmojiType(
  reaction: MessageReaction
): Promise<EmojiType> {
  const dbEmoji = await findEmoji(reaction.emoji);

  if (!dbEmoji) {
    return "regular";
  }

  // 1. Check for Feature Rule
  if (dbEmoji.name === config.FEATURE_EMOJI) {
    return "feature";
  }

  // 2. Check for Category Rule
  const categoryRule = await findEmojiCategoryRule(dbEmoji.id);
  if (categoryRule) {
    return "category";
  }

  // 3. Check for Payment Rule
  const paymentRule = await findEmojiPaymentRule(dbEmoji.id);
  if (paymentRule) {
    return "payment";
  }

  return "regular";
}

export async function isPaymentUnitValid(
  dbContentId: string,
  contentType: ContentType,
  paymentRule: PaymentRule | null
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

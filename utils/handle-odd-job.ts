import { logger } from "@/client";
import { findOrCreateOddJob } from "@/data/oddjob";
import {
  Attachment,
  Collection,
  Message,
  MessageMentions,
  PartialMessage,
  User,
} from "discord.js";
import { OddJob } from "@prisma/client";
import { storeAttachment } from "@/data/attachment";
import * as config from "@/config";
import { OddjobWithEarnings } from "@/types";

export type OddJobType = {
  role: string;
  description: string;
  timeline: string;
  payment: { amount: number; unit: string };
  manager: User;
};

export async function handleOddJob(
  message: Message<boolean>,
  messageLink: string
): Promise<OddjobWithEarnings | undefined> {
  let oddJob: OddjobWithEarnings | undefined;

  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedOddJob = parseOddjob(
    message.content!,
    message.mentions,
    message.attachments
  );

  if (!parsedOddJob) {
    logger.error(
      `Odd job missing required fields in the channel ${messageLink}`
    );
  } else {
    const { description, manager, payment, role, timeline } = parsedOddJob;
    logger.log(`New odd job in the channel ${messageLink}`);
    logger.log(`↪ role: ${role}`);
    logger.log(`↪ description: ${description}`);
    logger.log(`↪ timeline: ${timeline}`);
    logger.log(`↪ payment: ${payment?.amount} ${payment?.unit}`);
    logger.log(`↪ manager: ${manager.username}`);

    oddJob = await findOrCreateOddJob(
      message,
      messageLink,
      role,
      description,
      timeline,
      payment?.amount,
      payment?.unit,
      manager
    );

    if (oddJob && message.author && message.attachments.size > 0) {
      if (message.attachments.size > 5) {
        logger.logAndSend(
          `🚨 Only the first 5 attachments will be saved for ${messageLink}. ${message.attachments.size} were provided.`,
          message.author!
        );
      }
      // only consider the first 5 attachments
      const attachments = Array.from(message.attachments.values()).slice(0, 5);

      attachments.forEach(async (attachment) => {
        if (attachment.size < config.MAX_FILE_SIZE) {
          const attachmentData = {
            url: attachment.url,
            name: attachment.name,
            mimeType: attachment.contentType || "application/octet-stream", // Default to a generic binary type if not provided
            size: attachment.size,
            oddJobId: oddJob!.id,
          };

          try {
            await storeAttachment(attachmentData);
            logger.log(`↪ Attachment ${attachment.name} saved successfully.`);
          } catch (error) {
            logger.error(`Error saving attachment ${attachment.name}:`, error);
          }
        } else {
          logger.logAndSend(
            `🚨 Attachment ${attachment.name} for ${messageLink} exceeds the ${
              config.MAX_FILE_SIZE / 1024 / 1024
            }MB size limit and won't be saved.`,
            message.author!
          );
        }
      });
    }
  }

  return oddJob;
}

/**
 * Parses a message for oddjob information
 * Odd-Job Role:
 * Odd-Job Description:
 * Odd-Job Timeline:
 * Agreed Payment:
 * Managing Director:
 * @param message
 * @returns
 */
export function parseOddjob(
  message: string,
  mentions: MessageMentions,
  attachments: Collection<string, Attachment>
): OddJobType | null {
  try {
    const roleRegex = /Odd-Job Role:\s*(.+?)(?=\n|$)/;
    const descriptionRegex = /Odd-Job Description:\s*(.+?)(?=\n|$)/;
    const timelineRegex = /Odd-Job Timeline:\s*(.+?)(?=\n|$)/;
    const paymentRegex = /Agreed Payment:\s*(.+?)(?=\n|$)/;
    const managerRegex = /Managing Director:\s*(.+?)(?=\n|$)/;

    const roleMatch = message.match(roleRegex);
    const descriptionMatch = message.match(descriptionRegex);
    const timelineMatch = message.match(timelineRegex);
    const paymentMatch = message.match(paymentRegex);
    const managerMatch = message.match(managerRegex);

    let manager: User | null = null;
    if (managerMatch && managerMatch[1]) {
      // Extract ID from mention format e.g., <@450723766939549696>
      const managerId = managerMatch[1].replace(/<@!?(\d+)>/, "$1");

      // Find the user by ID in the mentions
      manager = mentions.users.get(managerId) || null;
    }

    const parsedPayment = paymentMatch ? parsePayment(paymentMatch[1]) : null;

    if (
      manager === null ||
      !managerMatch ||
      !managerMatch[1] ||
      !roleMatch ||
      !descriptionMatch ||
      !timelineMatch ||
      !parsedPayment ||
      !parsedPayment.amount ||
      !parsedPayment.unit
    ) {
      return null;
    }

    return {
      role: roleMatch[1].trim(),
      description: descriptionMatch[1].trim(),
      timeline: timelineMatch[1].trim(),
      payment: {
        amount: parsedPayment.amount!,
        unit: parsedPayment.unit!,
      },
      manager,
    };
  } catch (error) {
    logger.error("Error parsing odd job:", error);
    return null;
  }
}

/**
 * parsePayment is a helper function that takes a payment string,
 * matches the numeric part (amount)
 * and the text part (unit), and returns an object with amount and unit.
 * @param paymentString
 * @returns
 */
function parsePayment(paymentString: string): {
  amount: number | null;
  unit: string | null;
} {
  // Normalize the payment string by replacing "$" with "USD"
  let normalizedPaymentString = paymentString
    .replace(/^\$/, "USD ")
    .replace(/\$$/, " USD");

  // Regular expression to match both scenarios: "600 USD" or "USD 600"
  const paymentRegex = /(\d+(\.\d+)?)\s*(\w+)|(\w+)\s*(\d+(\.\d+)?)/;
  const match = normalizedPaymentString.match(paymentRegex);

  if (match) {
    const amount = parseFloat(match[1] ?? match[5]);
    const unit = match[3] ?? match[4] ?? "USD"; // Default to USD if unit not found

    return {
      amount: !isNaN(amount) && amount !== 0 ? amount : null,
      unit: unit,
    };
  } else {
    return { amount: null, unit: null };
  }
}

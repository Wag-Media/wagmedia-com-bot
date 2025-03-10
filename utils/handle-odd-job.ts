import { Message, User } from "discord.js";
import { logger } from "@/client";
import { findOrCreateOddJob } from "@/data/oddjob";
import { storeAttachment } from "@/data/attachment";
import * as config from "@/config";

import type { OddjobWithEarnings } from "@/types";

export type OddJobType = {
  role: string | undefined;
  description: string | undefined;
  timeline: string | undefined;
  payment:
    | { amount: number | null | undefined; unit: string | null | undefined }
    | undefined;
  manager: User | null;
};

function isValidRole(role: string): boolean {
  return config.ODDJOB_ROLE_OPTIONS.some(
    (option) => option.name.toLowerCase() === role.toLowerCase(),
  );
}

export async function handleOddJob(
  message: Message<boolean>,
  messageLink: string,
): Promise<OddjobWithEarnings | undefined> {
  let oddJob: OddjobWithEarnings | undefined;

  // content is not null because we checked for it in shouldIgnoreMessage
  const parsedOddJob = parseOddjob(message);

  if (!parsedOddJob) {
    logger.error(
      `Odd job missing required fields in the channel ${messageLink}`,
    );
    return;
  }

  const { description, manager, payment, role, timeline } = parsedOddJob;

  const missingFields: string[] = [];

  if (!role) missingFields.push("role");
  if (!description) missingFields.push("description");
  if (!timeline) missingFields.push("timeline");
  if (!manager) missingFields.push("manager");
  if (!payment?.amount) missingFields.push("payment amount");
  if (!payment?.unit) missingFields.push("payment unit");

  // Check if the message contains all necessary information
  if (missingFields.length > 0) {
    let extraInfo = "";
    if (!payment?.unit) {
      extraInfo += `Accepted units: ${findUniqueUnitsFromConfig()
        .map((u) => `\`${u}\``)
        .join(", ")}\n`;
    }

    if (!role) {
      extraInfo += `Accepted roles: ${config.ODDJOB_ROLE_OPTIONS.map((option) => `\`${option.name}\``).join(", ")}\n`;
    }

    logger.logAndSend(
      `Odd job ${messageLink} is missing required fields: ${missingFields.join(
        ", ",
      )}.\n\n${extraInfo}`,
      message.author!,
      "warn",
    );
    return;
  }

  logger.log(
    `[oddjob] New valid oddjob ${messageLink} by ${
      message.member?.displayName
    } for **${payment?.amount} ${payment?.unit}** and managed by **${
      manager!.username
    }**`,
  );

  oddJob = await findOrCreateOddJob(
    message,
    messageLink,
    role!,
    description!,
    timeline!,
    payment?.amount!,
    payment?.unit!,
    manager!,
  );

  if (oddJob && message.author && message.attachments.size > 0) {
    if (message.attachments.size > 5) {
      logger.logAndSend(
        `🚨 Only the first 5 attachments will be saved for ${messageLink}. ${message.attachments.size} were provided.`,
        message.author!,
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
          message.author!,
        );
      }
    });
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
export function parseOddjob(message: Message): OddJobType {
  const { content, mentions, attachments } = message;

  try {
    const cleanedContent = content.replace(/\*/g, "");

    const roleRegex = /Odd-Job Role:\s*([\s\S]+?)(?=Odd-Job Description:|$)/;
    const descriptionRegex =
      /Odd-Job Description:\s*([\s\S]+?)(?=Odd-Job Timeline:|$)/;
    const timelineRegex = /Odd-Job Timeline:\s*([\s\S]+?)(?=Agreed Payment:|$)/;
    const paymentRegex = /Agreed Payment:\s*([\s\S]+?)(?=Managing Director:|$)/;
    const managerRegex = /Managing Director:\s*(.+?)(?=\n|$)/;

    const roleMatch = cleanedContent.match(roleRegex);
    const descriptionMatch = cleanedContent.match(descriptionRegex);
    const timelineMatch = cleanedContent.match(timelineRegex);
    const paymentMatch = cleanedContent.match(paymentRegex);
    const managerMatch = cleanedContent.match(managerRegex);

    let manager: User | null = null;
    if (managerMatch && managerMatch[1]) {
      // Extract ID from mention format e.g., <@450723766939549696>
      const managerId = managerMatch[1].replace(/<@!?(\d+)>/, "$1");

      // Find the user by ID in the mentions
      manager = mentions.users.get(managerId) || null;
    }

    const parsedPayment = paymentMatch ? parsePayment(paymentMatch[1]) : null;

    let role = roleMatch?.[1].trim();
    role =
      role && isValidRole(role)
        ? config.ODDJOB_ROLE_OPTIONS.find(
            (option) => option.name.toLowerCase() === role!.toLowerCase(),
          )?.value
        : undefined;

    return {
      role,
      description: descriptionMatch?.[1].trim(),
      timeline: timelineMatch?.[1].trim(),
      payment: {
        amount: parsedPayment?.amount,
        unit: parsedPayment?.unit,
      },
      manager,
    };
  } catch (error) {
    logger.error("Error parsing odd job:", error);
    return {
      role: undefined,
      description: undefined,
      timeline: undefined,
      payment: undefined,
      manager: null,
    };
  }
}

/**
 * parsePayment is a helper function that takes a payment string,
 * matches the numeric part (amount)
 * and the text part (unit), and returns an object with amount and unit.
 * @param paymentString
 * @returns
 */
export function parsePayment(paymentString: string): {
  amount: number | null;
  unit: string | null;
} {
  // Normalize the payment string by replacing "$" with "USD"
  let normalizedPaymentString = paymentString
    .replace(/^\$/, "USD ")
    .replace(/\$$/, " USD");

  // Remove commas used as thousand separators
  normalizedPaymentString = normalizedPaymentString.replace(/,/g, "");

  // read accepted units from config
  const acceptedUnits = findUniqueUnitsFromConfig();

  // Create a dynamic regex pattern based on accepted units
  const unitsPattern = acceptedUnits.join("|");
  const paymentRegex = new RegExp(
    `(\\d+(\\.\\d+)?)\\s*(${unitsPattern})|(${unitsPattern})\\s*(\\d+(\\.\\d+)?)`,
  );

  const match = normalizedPaymentString.match(paymentRegex);

  if (match) {
    // Extract the amount and unit from the match
    const amount = parseFloat(match[1] ?? match[5]);
    const unit = match[3] ?? match[4] ?? null; // Do not default to "USD", ensure unit is in the accepted list

    // Validate the extracted unit
    const isUnitAccepted = acceptedUnits.includes(unit ?? "");

    return {
      amount: !isNaN(amount) && amount !== 0 ? amount : null,
      unit: isUnitAccepted ? unit : null,
    };
  } else {
    return { amount: null, unit: null };
  }
}

export function findUniqueUnitsFromConfig() {
  const paymentMap = config.paymentEmojiMap;
  const uniqueUnits = new Set();
  Object.values(paymentMap).forEach((item) => {
    uniqueUnits.add(item.currency);
  });
  return Array.from(uniqueUnits);
}

export function isOddJobValid(oddjob: OddJobType): boolean {
  return !!(
    oddjob.role &&
    oddjob.description &&
    oddjob.timeline &&
    oddjob.payment?.amount &&
    oddjob.payment?.unit &&
    oddjob.manager
  );
}

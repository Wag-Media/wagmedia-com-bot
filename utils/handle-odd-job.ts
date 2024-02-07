import { logger } from "@/client";
import { findOrCreateOddJob } from "@/data/oddjob";
import { Message, MessageMentions, PartialMessage, User } from "discord.js";
import { OddJob } from "@prisma/client";

export async function handleOddJob(
  message: Message<boolean> | PartialMessage,
  messageLink: string
) {
  let oddJob: OddJob | null = null;

  // content is not null because we checked for it in shouldIgnoreMessage
  const { description, manager, payment, role, timeline } = parseOddjob(
    message.content!,
    message.mentions
  );

  if (
    !role ||
    !description ||
    !timeline ||
    !payment ||
    !payment.amount ||
    !payment.unit ||
    !manager
  ) {
    logger.error(
      `Odd job missing required fields in the channel ${messageLink}`
    );
  } else {
    logger.log(`New odd job in the channel ${messageLink}`);
    logger.log(`↪ id: ${message.id}`);
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
  mentions: MessageMentions
): {
  role: string | null;
  description: string | null;
  timeline: string | null;
  payment: { amount: number | null; unit: string | null } | null;
  manager: User | null;
} {
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

  console.log("the manager match is", managerMatch);

  let manager: User | null = null;
  if (managerMatch && managerMatch[1]) {
    // Extract ID from mention format e.g., <@450723766939549696>
    const managerId = managerMatch[1].replace(/<@!?(\d+)>/, "$1");

    // Find the user by ID in the mentions
    manager = mentions.users.get(managerId) || null;
  }

  const parsedPayment = paymentMatch ? parsePayment(paymentMatch[1]) : null;

  return {
    role: roleMatch ? roleMatch[1].trim() : null,
    description: descriptionMatch ? descriptionMatch[1].trim() : null,
    timeline: timelineMatch ? timelineMatch[1].trim() : null,
    payment: parsedPayment,
    manager,
  };
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

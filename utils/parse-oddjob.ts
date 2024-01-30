import { parseDiscordUserId } from "@/handlers/util";

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
export function parseOddjob(message: string): {
  role: string | null;
  description: string | null;
  timeline: string | null;
  payment: { amount: number | null; unit: string | null } | null;
  manager: string | null;
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

  const parsedPayment = paymentMatch ? parsePayment(paymentMatch[1]) : null;

  const parsedManager = managerMatch
    ? parseDiscordUserId(managerMatch[1])
    : null;

  return {
    role: roleMatch ? roleMatch[1].trim() : null,
    description: descriptionMatch ? descriptionMatch[1].trim() : null,
    timeline: timelineMatch ? timelineMatch[1].trim() : null,
    payment: parsedPayment,
    manager: parsedManager,
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

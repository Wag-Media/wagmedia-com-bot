/**
 * Checks if the given emoji is a flag emoji
 * @param emoji
 * @returns
 */
export function isCountryFlag(emoji: string | null): boolean {
  if (!emoji) return false;

  // Regular expression to match exactly one flag emoji
  // The ^ and $ anchors ensure that the entire string is just one flag emoji
  const flagRegex = /^\p{Regional_Indicator}{2}$/u;

  return flagRegex.test(emoji);
}

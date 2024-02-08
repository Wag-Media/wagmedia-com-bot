/**
 * Checks if the given emoji is a flag emoji
 * @param emoji
 * @returns
 */
export function isCountryFlag(emoji: string | null): boolean {
  console.log("isCountryFlag", emoji);
  if (!emoji) return false;

  // Regular expression to match exactly one flag emoji
  // The ^ and $ anchors ensure that the entire string is just one flag emoji
  const flagRegex = /^\p{Regional_Indicator}{2}$/u;

  console.log("flagRegex.test(emoji)", flagRegex.test(emoji));

  return flagRegex.test(emoji);
}

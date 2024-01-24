export function extractUnit(str: string): string {
  // This regular expression matches one or more digits (0-9) at the start of the string
  // and replaces them with an empty string, leaving only the non-numeric part
  return str.replace(/^\d+/, "");
}

export function parseMessage(message: string): {
  title: string;
  description: string;
  tags: string[];
} {
  // Regular expressions to match title and description (case-insensitive)
  const titleRegex = /title:\s*(.*?)\s*\n/i;
  const descriptionRegex = /description:\s*([\s\S]*?)(?=\n\S+:|$)/i;
  const tagsRegex = /hashtags:\s*([\s\S]*?)\s*$/i;

  // Extracting title and description using the regular expressions
  const titleMatch = message.match(titleRegex);
  const descriptionMatch = message.match(descriptionRegex);
  const tagsMatch = message.match(tagsRegex);

  const title = titleMatch ? titleMatch[1].trim() : "";
  const description = descriptionMatch ? descriptionMatch[1].trim() : "";
  const tagsString = tagsMatch ? tagsMatch[1].trim() : "";

  // Process the hashtags string: split, remove leading '#'
  const tags = tagsString
    .split(/,?\s+/)
    .map((tag) => (tag.startsWith("#") ? tag.substring(1) : tag))
    .filter((tag) => tag.length > 1);

  return { title, description, tags };
}

export async function replaceAuthorLinks(
  text: string,
  withLink: boolean = true,
): Promise<string> {
  // Patterns to match author URLs
  const authorPattern = /<@(\d+)>/gi;

  const allAuthrorIds = text
    .match(authorPattern)
    ?.map((id) => id.replace("<@", "").replace(">", ""));
  if (!allAuthrorIds) return text;

  const authors = await prisma.user.findMany({
    where: {
      discordId: {
        in: allAuthrorIds,
      },
    },
  });
  if (!authors) return text;

  //replace each author with a link to their profile
  authors.forEach((author) => {
    text = text.replace(
      new RegExp(`<@${author.discordId}>`, "gi"),
      withLink
        ? `<a href="/creator/${author.name}" className="no-underline"><img src="${author.avatar}" alt="${author.name}" class="w-5 h-5 rounded-full !p-0 !m-0 !mr-1 inline" />${author.name}</a>`
        : `@${author.name}`,
    );
  });

  return text;
}

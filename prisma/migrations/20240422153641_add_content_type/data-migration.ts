const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());

async function main() {
  console.log(
    "Running data migration to add contentType to posts based on discordLink.",
  );
  console.log("channels_articles:", process.env.CHANNELS_ARTICLES);
  console.log("channels_news:", process.env.CHANNELS_NEWS);

  await prisma.$transaction(async (tx) => {
    const channelsArticles = process.env.CHANNELS_ARTICLES
      ? JSON.parse(process.env.CHANNELS_ARTICLES)
      : null;
    const channelsNews = process.env.CHANNELS_NEWS
      ? JSON.parse(process.env.CHANNELS_NEWS)
      : null;

    if (!channelsArticles || !channelsNews) {
      console.log(
        "Environment variables for channels are not set correctly in CHANNELS_ARTICLES and CHANNELS_NEWS.",
      );
      return;
    }

    // Generate dynamic OR conditions for article channels
    const articleConditions = channelsArticles.map((channel) => ({
      discordLink: {
        contains: channel,
      },
    }));

    // Generate dynamic OR conditions for news channels
    const newsConditions = channelsNews.map((channel) => ({
      discordLink: {
        contains: channel,
      },
    }));

    console.log("Article conditions:", articleConditions);
    console.log("News conditions:", newsConditions);

    // Update posts setting contentType to 'article' where discordLink matches any article channel
    const updatedArticles = await tx.post.updateMany({
      where: {
        OR: articleConditions,
      },
      data: {
        contentType: "article",
      },
    });

    // Update posts setting contentType to 'news' where discordLink matches any news channel
    const updatedNews = await tx.post.updateMany({
      where: {
        OR: newsConditions,
      },
      data: {
        contentType: "news",
      },
    });

    console.log(
      `${updatedArticles.count} posts updated to article based on discordLink.`,
    );
    console.log(
      `${updatedNews.count} posts updated to news based on discordLink.`,
    );
  });
}

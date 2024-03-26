import { PrismaClient } from "@prisma/client";
import * as config from "../config";
import { logger } from "../client";

const prisma = new PrismaClient();

async function main() {
  // 1) Seed Categories and Emojis for Category Rules
  for (const categoryName in config.categoryEmojiMap) {
    try {
      const emojiName = config.categoryEmojiMap[categoryName];

      const emoji = await prisma.emoji.upsert({
        where: {
          id: emojiName,
        },
        update: {},
        create: {
          id: emojiName,
          name: emojiName,
        },
      });

      const category = await prisma.category.upsert({
        where: {
          name: categoryName,
        },
        update: {
          name: categoryName,
          emojiId: emoji.id,
        },
        create: {
          name: categoryName,
          emojiId: emoji.id,
        },
      });

      // 1.1) Seed Category Rules
      await prisma.categoryRule.upsert({
        where: {
          emojiId: emoji.id,
        },
        update: {},
        create: {
          categoryId: category.id,
          emojiId: emoji.id,
        },
      });
    } catch (e) {
      logger.log("error seeding category", categoryName, e);
    }
  }

  // 2) Seed Emojis for Payment Rules
  for (const paymentEmojiName in config.paymentEmojiMap) {
    try {
      const paymentValue = config.paymentEmojiMap[paymentEmojiName].amount;
      const paymentUnit = config.paymentEmojiMap[paymentEmojiName].currency;
      const paymentFundingSource =
        config.paymentEmojiMap[paymentEmojiName].fundingSource;
      const emoji = await prisma.emoji.upsert({
        where: {
          id: paymentEmojiName,
        },
        update: {},
        create: {
          id: paymentEmojiName,
          name: paymentEmojiName,
        },
      });

      // 2.1) Seed Payment Rules
      await prisma.paymentRule.upsert({
        where: {
          emojiId: emoji.id,
        },
        update: {},
        create: {
          emojiId: emoji.id,
          paymentAmount: paymentValue,
          paymentUnit,
          fundingSource: paymentFundingSource,
        },
      });
    } catch (e) {
      logger.log("error seeding payment", paymentEmojiName, e);
    }
  }
}

main()
  .catch((e) => {
    logger.log("error seeding the db", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from "@prisma/client";
import * as config from "../config";
import { extractUnit } from "../utils/extractUnit";
import { logger } from "../client";

const prisma = new PrismaClient();

async function main() {
  // 1) Seed Categories and Emojis for Category Rules
  for (const categoryName in config.categoryEmojiMap) {
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
    await prisma.categoryRule.create({
      data: { categoryId: category.id, emojiId: emoji.id },
    });
  }

  // 2) Seed Emojis for Payment Rules
  for (const paymentEmojiName in config.paymentEmojiMap) {
    const paymentValue = config.paymentEmojiMap[paymentEmojiName];
    const paymentUnit = extractUnit(paymentEmojiName);
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
    await prisma.paymentRule.create({
      data: { emojiId: emoji.id, paymentAmount: paymentValue, paymentUnit },
    });
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

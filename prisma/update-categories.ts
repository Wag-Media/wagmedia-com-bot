//update the categories in the database from the config.ts file
import { PrismaClient } from "@prisma/client";
import * as config from "../config";
const prisma = new PrismaClient();

export async function updateCategories() {
  const categories = Object.keys(config.categoryEmojiMap);
  const dbCategories = await prisma.category.findMany();

  //check if the categories are in the database
  const categoriesInDb = dbCategories.map((category) => category.name);
  const categoriesNotInDb = categories.filter(
    (category) => !categoriesInDb.includes(category),
  );

  console.log(
    `Found ${dbCategories.length} categories in the database: ${dbCategories
      .map((category) => category.name)
      .join(", ")}`,
  );

  //create the categories that are not in the database
  const categoriesToCreate = categoriesNotInDb.map((category) => ({
    name: category,
    emoji: config.categoryEmojiMap[category],
  }));

  console.log(
    `Creating ${categoriesToCreate.length} missing categories: ${categoriesToCreate
      .map((category) => `${category.name}: (${category.emoji})`)
      .join(", ")}`,
  );

  for (const name in config.categoryEmojiMap) {
    try {
      const emojiName = config.categoryEmojiMap[name];

      // 1) Seed Emoji
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

      // 2) Seed Category
      const category = await prisma.category.upsert({
        where: {
          name: name,
        },
        update: {
          name: name,
          emojiId: emoji.id,
        },
        create: {
          name: name,
          emojiId: emoji.id,
        },
      });

      // 3) Seed Category Rules
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
      console.log("error seeding category", name, e);
    }
  }

  console.log("Categories updated successfully");
}

async function main() {
  await updateCategories();
}

main();

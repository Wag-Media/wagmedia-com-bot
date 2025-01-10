import { logger } from "@/client";
import {
  updateUserBio,
  updateUserDomain,
  updateUserTwitter,
} from "@/data/user";
import { findOrCreateUserFromDiscordUser } from "@/data/user";
import { getPostsByUser } from "@/data/user";
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

import validator from "validator";

function sanitizeBio(input: string): string {
  return validator
    .escape(validator.stripLow(validator.trim(input)))
    .slice(0, 500);
}

export const data = new SlashCommandBuilder()
  .setName("creator")
  .setDescription(
    "Add details to your WagMedia account, that will appear on the WagMedia Website",
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("biography")
      .setDescription("Add a short biography to your account")
      .addStringOption((option) =>
        option
          .setName("bio")
          .setDescription("The bio you want to add")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("domain")
      .setDescription(
        "Add a domain to your account, that will appear on the WagMedia Website",
      )
      .addStringOption((option) =>
        option
          .setName("domain")
          .setDescription("The domain you want to add")
          .setRequired(true),
      ),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName("twitter_x")
      .setDescription(
        "Add your Twitter username to your account, so it can be shown on the WagMedia Website",
      )
      .addStringOption((option) =>
        option
          .setName("username")
          .setDescription("Your Twitter username")
          .setRequired(true),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.isChatInputCommand()) return;

  const subcommand = interaction.options.getSubcommand();

  logger.log(
    `[command] /creator ${subcommand} executed by ${interaction.user.username} with options: 
      ${interaction.options.data.map((option) => `${option.options?.map((o) => `${o.name}: ${o.value}`).join(", ")}`).join(", ")}`,
  );

  if (subcommand === "biography") {
    await executeBio(interaction);
  } else if (subcommand === "domain") {
    await executeDomain(interaction);
  } else if (subcommand === "twitter_x") {
    await executeTwitter(interaction);
  } else {
    return await interaction.editReply({
      content:
        "Invalid subcommand. Please use /creator bio, /creator domain, or /creator twitter",
    });
  }
}

export async function executeBio(interaction: ChatInputCommandInteraction) {
  try {
    const dbUser = await findOrCreateUserFromDiscordUser(interaction.user);
    const posts = await getPostsByUser(dbUser.discordId);

    if (posts.length === 0) {
      return await interaction.editReply({
        content:
          "⚠️ You need to have at least one published post to use this command. Create a post first and make sure it is of high quality so it gets published on WagMedia.",
      });
    }

    const rawBio = interaction.options.getString("bio");
    if (!rawBio) {
      return await interaction.editReply({
        content: "No bio provided.",
      });
    }
    const sanitizedBio = sanitizeBio(rawBio);

    // Validate final result
    if (sanitizedBio.length < 10) {
      return await interaction.editReply({
        content:
          "Bio must be at least 10 characters long after removing invalid characters.",
      });
    }

    if (sanitizedBio !== rawBio) {
      await interaction.editReply({
        content: `⚠️ Your bio contained invalid characters and was sanitized to: "${sanitizedBio}"\n\nPress the command again with this sanitized version if you're happy with it.`,
      });
      return;
    }

    await updateUserBio(dbUser.discordId, sanitizedBio);

    await interaction.editReply({
      content: `Your bio has been added: ${sanitizedBio}.\n\nYou can now edit it again with \`/bio\` if you want to change it and [view it on WagMedia](http://localhost:3000/creator/${dbUser.name})`,
    });
  } catch (error) {
    console.error(error);
    return await interaction.editReply({
      content: "An error occurred while adding your bio.",
    });
  }
}

export async function executeDomain(interaction: ChatInputCommandInteraction) {
  const dbUser = await findOrCreateUserFromDiscordUser(interaction.user);
  const posts = await getPostsByUser(dbUser.discordId);

  if (posts.length === 0) {
    return await interaction.editReply({
      content:
        "⚠️ You need to have at least one published post to use this command. Create a post first and make sure it is of high quality so it gets published on WagMedia.",
    });
  }

  const rawDomain = interaction.options.getString("domain");

  if (!rawDomain) {
    return await interaction.editReply({
      content: "No domain provided.",
    });
  }

  if (!rawDomain.startsWith("https://") && !rawDomain.startsWith("http://")) {
    return await interaction.editReply({
      content: "Domain must start with https:// or http://",
    });
  }

  await updateUserDomain(dbUser.discordId, rawDomain);

  await interaction.editReply({
    content: "Domain added",
  });
}

export async function executeTwitter(interaction: ChatInputCommandInteraction) {
  const dbUser = await findOrCreateUserFromDiscordUser(interaction.user);
  const posts = await getPostsByUser(dbUser.discordId);

  if (posts.length === 0) {
    return await interaction.editReply({
      content:
        "⚠️ You need to have at least one published post to use this command. Create a post first and make sure it is of high quality so it gets published on WagMedia.",
    });
  }

  const rawTwitterUsername = interaction.options.getString("username");

  if (!rawTwitterUsername) {
    return await interaction.editReply({
      content: "No Twitter username provided.",
    });
  }

  let sanitizedTwitterUsername = rawTwitterUsername;

  if (rawTwitterUsername.startsWith("@")) {
    sanitizedTwitterUsername = rawTwitterUsername.slice(1);
  }

  if (sanitizedTwitterUsername.length < 3) {
    return await interaction.editReply({
      content: "Twitter username must be at least 3 characters long.",
    });
  }

  if (sanitizedTwitterUsername.includes(" ")) {
    return await interaction.editReply({
      content: "Twitter username must not contain spaces.",
    });
  }

  if (sanitizedTwitterUsername.includes(".")) {
    return await interaction.editReply({
      content: "Twitter username must not contain dots.",
    });
  }

  await updateUserTwitter(dbUser.discordId, sanitizedTwitterUsername);

  await interaction.editReply({
    content: "Twitter username added",
  });
}

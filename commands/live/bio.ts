import {
  findOrCreateUserFromDiscordUser,
  getPostsByUser,
  updateUserBio,
} from "@/data/user";
import { SlashCommandBuilder } from "discord.js";

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
      .setName("bio")
      .setDescription("Add a short bio to your account")
      .addStringOption((option) =>
        option
          .setName("bio")
          .setDescription("The bio you want to add")
          .setRequired(true),
      ),
  );

export async function execute(interaction: any) {
  await interaction.deferReply({ ephemeral: true });

  // Check if user is verified
  // if (!interaction.member.roles.cache.has(process.env.VERIFIED_ROLE_ID)) {
  //   return await interaction.editReply({
  //     content:
  //       "You need to be verified to use this command. Please verify yourself first.",
  //   });
  // }

  const dbUser = await findOrCreateUserFromDiscordUser(interaction.user);
  const posts = await getPostsByUser(dbUser.discordId);

  if (posts.length === 0) {
    return await interaction.editReply({
      content:
        "⚠️ You need to have at least one published post to use this command. Create a post first and make sure it is of high quality so it gets published on WagMedia.",
    });
  }

  const rawBio = interaction.options.getString("bio");
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
}

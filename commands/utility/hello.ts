import { logger } from "@/client";
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
export const data = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say Hello to you")
  .addStringOption((option) =>
    option.setName("name").setDescription("Your name").setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString("name");
  logger.log(
    `[command] /hello ${name} executed by ${interaction.user.username}`,
  );
  await interaction.reply(`Hello! ${name}`);
}

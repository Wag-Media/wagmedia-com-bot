import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Replies with Pong!");

export async function execute(interaction) {
  console.log(`Starting ping command for user ${interaction.user.id}`);
  await interaction.reply("Pong!");
}

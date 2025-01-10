import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Routes,
} from "discord.js";

interface UserConnection {
  type: string;
  id: string;
  name: string;
  verified: boolean;
  visible: boolean;
}

export const data = new SlashCommandBuilder()
  .setName("connections")
  .setDescription("View your connected accounts");

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Make the REST request
    const connections = (await interaction.client.rest.get(
      Routes.userConnections(),
    )) as UserConnection[];

    console.log("connections", connections);

    if (!connections?.length) {
      await interaction.reply({
        content: "You have no visible connected accounts.",
        ephemeral: true,
      });
      return;
    }

    const connectionsList = connections
      .filter((conn) => conn.visible)
      .map((conn) => `- ${conn.type}: ${conn.name}${conn.verified ? " ✓" : ""}`)
      .join("\n");

    await interaction.reply({
      content: `Your connected accounts:\n${connectionsList}`,
      ephemeral: true,
    });
  } catch (error) {
    console.error("Error fetching connections:", error);
    await interaction.reply({
      content:
        "Failed to fetch connected accounts. Make sure the bot has the required permissions.",
      ephemeral: true,
    });
  }
}

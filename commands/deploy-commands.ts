import { DiscordAPIError, REST, Routes } from "discord.js";
import * as commands from "./";
import { logger } from "@/client";

type DeployCommandsProps = {
  guildId: string;
};

export async function deployCommands({ guildId }: DeployCommandsProps) {
  try {
    const commandsData = Object.values(commands).map((command) =>
      command.data.toJSON(),
    );

    console.log(
      `Started refreshing ${commandsData.length} application (/) commands on guild ${guildId}`,
    );

    const token = process.env["DISCORD_BOT_TOKEN"];

    if (!token) {
      console.error(
        "DISCORD_BOT_TOKEN is not set in the environment variables.",
      );
      process.exit(1);
    }

    const rest = new REST().setToken(token);
    const clientId = process.env["DISCORD_CLIENT_ID"];

    if (!clientId) {
      console.error(
        "DISCORD_CLIENT_ID is not set in the environment variables.",
      );
      process.exit(1);
    }

    const data = await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commandsData },
    );

    logger.log(
      `Successfully reloaded ${commandsData.length} application (/) commands.`,
    );
  } catch (error) {
    if (error instanceof DiscordAPIError) {
      console.error(
        `Commands deployment failed, bot running without commands: Discord API Error: ${error.message} (Code: ${error.code})`,
      );
    } else {
      console.error("An unexpected error occurred:", error);
    }
  }
}

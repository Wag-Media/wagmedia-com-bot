import { wrapUrlsInMessage } from "@/handlers/log-utils";
import { Client, PermissionsBitField, TextChannel, User } from "discord.js";
import * as config from "@/config";

export class DiscordLogger {
  private discordClient: Client;
  private channelId: string;
  private doLogToDiscord: boolean;

  constructor(discordClient: Client, channelId: string) {
    this.discordClient = discordClient;
    this.channelId = channelId;
    this.doLogToDiscord = process.env["LOG_TO_DISCORD"] === "true";
  }

  private async maybeLogToDiscord(
    level: string,
    ...messages: any[]
  ): Promise<void> {
    if (!this.doLogToDiscord) {
      return;
    }

    // Check if the client is ready
    if (!this.discordClient.isReady()) {
      console.warn("DiscordLogger: Discord client is not ready.");
      return;
    }

    // Check if a channel ID has been provided
    if (!this.channelId) {
      console.warn("DiscordLogger: No channel ID provided.");
      return;
    }

    // Combine all messages into a single string
    const combinedMessage = messages
      .map((message) =>
        typeof message === "object" ? JSON.stringify(message) : message,
      )
      .join("");

    try {
      const channel = (await this.discordClient.channels.fetch(
        this.channelId,
      )) as TextChannel;

      const logLevelPrefix = config.LOG_THE_LEVEL_IN_DISCORD
        ? `[${level.toUpperCase()}]`
        : "";

      if (this.discordClient.user && channel) {
        const permissions = channel.permissionsFor(this.discordClient.user);
        if (
          permissions &&
          permissions.has(PermissionsBitField.Flags.SendMessages)
        ) {
          channel.send(`${logLevelPrefix}${combinedMessage}`);
        } else {
          console.warn(
            `DiscordLogger: Missing 'SEND_MESSAGES' permission in channel ${this.channelId}.`,
          );
        }
      } else {
        console.warn(`DiscordLogger: Client user or channel is null.`);
      }
    } catch (error: any) {
      // Handle specific DiscordAPIError for missing access
      if (error.code === 50001) {
        console.error(
          `DiscordLogger Error: Missing access to the channel (ID: ${this.channelId}).`,
        );
      } else {
        console.error(`DiscordLogger Error: ${error}`);
      }
    }
  }

  public log(...messages: any[]): void {
    console.log("[log]", ...messages);
    this.maybeLogToDiscord("log", ...messages).catch(console.error);
  }

  public info(...messages: any[]): void {
    console.info("[info]", ...messages);
    this.maybeLogToDiscord("info", ...messages).catch(console.error);
  }

  public warn(...messages: any[]): void {
    console.warn("[warn]", ...messages);
    this.maybeLogToDiscord("warn", ...messages).catch(console.error);
  }

  public error(...messages: any[]): void {
    console.error("[error]", ...messages);
    this.maybeLogToDiscord("error", ...messages).catch(console.error);
  }

  public logAndSend(message: string, user: User, level?: string): void {
    const logFunction = this[level || "log"];

    user.send(message).catch(console.error);
    logFunction.call(this, `[info] Informed user ${user.tag}: ${message}`);
  }
}

export default DiscordLogger;

// In a new file, say di-container.ts
import DiscordLogger from "./utils/DiscordLogger";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import * as config from "./config";

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [
    Partials.GuildMember,
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.User,
  ],
});

const logger = new DiscordLogger(discordClient, config.CHANNEL_LOG);

export { logger, discordClient };

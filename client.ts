import DiscordLogger from "./utils/DiscordLogger";
import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import * as config from "./config";

interface ExtendedClient extends Client<true> {
  commands?: Collection<string, any>;
}

const discordClient: ExtendedClient = new Client<true>({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
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

discordClient.commands = new Collection();

const logger = new DiscordLogger(discordClient, config.CHANNEL_LOG);

export { logger, discordClient };

import { Events } from "discord.js";
import dotenv from "dotenv";

// use .env  without extension file if node_env is not defined otherwise use .env.${node_env}
const app_env = process.env.APP_ENV;
const configPath = app_env ? `.env.${app_env}` : ".env";
dotenv.config({ path: configPath });

if (process.env.NODE_ENV !== "production") {
  console.log(`Using ${configPath} file for environment variables`);
}

export type Role = "Director" | "Admin" | "Moderator" | "Member";

/////// Discord Settings ///////
// see .env
export const CATEGORIES_TO_MONITOR = process.env.CATEGORIES_TO_MONITOR
  ? JSON.parse(process.env.CATEGORIES_TO_MONITOR)
  : [];

export const CHANNELS_TO_MONITOR = process.env.CHANNELS_TO_MONITOR
  ? JSON.parse(process.env.CHANNELS_TO_MONITOR)
  : [];

export const GUILD_ID = process.env.GUILD_ID || "";

export const CHANNELS_ODD_JOBS = process.env.CHANNELS_ODD_JOBS
  ? JSON.parse(process.env.CHANNELS_ODD_JOBS)
  : [];

export const CHANNELS_NEWSLETTER = process.env.CHANNELS_NEWSLETTER
  ? JSON.parse(process.env.CHANNELS_NEWSLETTER)
  : [];

export const CHANNELS_EVENTS = process.env.CHANNELS_EVENTS
  ? JSON.parse(process.env.CHANNELS_EVENTS)
  : [];

export const CHANNEL_LOG = process.env.CHANNEL_LOG
  ? process.env.CHANNEL_LOG.toString()
  : "";

export const LOG_THE_LEVEL_IN_DISCORD = false;

// Define the discord roles that have the power to trigger actions from EmojiActions
export const ROLES_WITH_POWER = ["Director"];

// the options for the role select menu in the /oddjob command
export const ODDJOB_ROLE_OPTIONS: { name: string; value: string }[] = [
  // Website and Discord Bot Development
  { name: "Developer", value: "developer" },
  { name: "QA and Product Owner", value: "qa_and_product_owner" },
  { name: "QA", value: "qa" },
  { name: "Product Owner", value: "product_owner" },
  { name: "WagTool", value: "wagtool" },
  { name: "Infra", value: "infra" },
  { name: "Web Designer", value: "web_designer" },

  // Management / Team
  { name: "Director", value: "director" },
  { name: "Social Media", value: "social_media" },
  { name: "Intern", value: "intern" },
  { name: "Treasury Management", value: "treasury_management" },
  { name: "Designer", value: "designer" },

  // Marketing
  { name: "Ads", value: "ads" },
  { name: "KaitoAI", value: "kaitoai" },
  { name: "Analytics", value: "analytics" },
];

/////// Emoji + DB Settings ///////
// the emoji that marks a post as featured
export const FEATURE_EMOJI = "WMFEATURED";

// the emoji that can publish a post without payment
export const UNIVERSAL_PUBLISH_EMOJI = "WMZERODOTPUB";

// the emoji that triggers the force reaction resolution, i.e. when this is added a post or oddjob reaction
// is forcefully synced from discord -> db
export const FORCE_REACTION_RESOLUTION_EMOJI = "♻️";

// the max file size for oddjob attachments
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// the name of the activity that will be shown in discord for the bot
export const BOT_ACTIVITY = "Managing Communications";

// the emojis that trigger the add category action.

// 🚨 The following values are only used for
// the seeding the database. If you want to add a new category, you need to add it to the
// database and then add it here.
export const categoryEmojiMap: {
  [key in string]: string;
} = {
  DeFi: "WMDEFI",
  Dubbing: "WMDUB",
  "Non Anglo": "WMNAO",
  NFT: "WMNFT",
  OpenGov: "WMOG",
  Parachain: "WMPARA",
  "Technical Analysis": "WMTA",
  Translations: "WMTRS",
  Tutorials: "WMTUT",
  Bounty: "WMBOUNTY",
  Video: "WMVIDEO",
  Paraverse: "WMPARAVERSE",
  Tip: "WMTIP",
  Wallet: "WMWALLET",
  RWA: "WMRWA",
  Rollup: "WMROLLUP",
  Meme: "WMMEME",
  JAM: "WMJAM",
  Grant: "WMGRANT",
  Events: "WMEVENTS",
  DV: "WMDV",
  DAO: "WMDAO",
  Coretime: "WMCORETIME",
};

export const NEWSLETTER_CATEGORY_NAME = "Newsletter";

// the emojis that trigger payment actions, that in turn publish a post.

// 🚨 The following values are only used for
// the seeding the database. If you want to add a new category, you need to add it to the
// database and then add it here.

// payments are recorded and executed by another bot: https://github.com/Wag-Media/wagmi-bot
export const paymentEmojiMap: {
  [key in string]: { amount: number; currency: string; fundingSource: string };
} = {
  // funding source: OpenGov-365
  "0005WMDOT": { amount: 0.005, currency: "DOT", fundingSource: "OpenGov-365" },
  "001WMDOT": { amount: 0.01, currency: "DOT", fundingSource: "OpenGov-365" },
  "002WMDOT": { amount: 0.02, currency: "DOT", fundingSource: "OpenGov-365" },
  "003WMDOT": { amount: 0.03, currency: "DOT", fundingSource: "OpenGov-365" },
  "005WMDOT": { amount: 0.05, currency: "DOT", fundingSource: "OpenGov-365" },
  "01WMDOT": { amount: 0.1, currency: "DOT", fundingSource: "OpenGov-365" },
  "02WMDOT": { amount: 0.2, currency: "DOT", fundingSource: "OpenGov-365" },
  "03WMDOT": { amount: 0.3, currency: "DOT", fundingSource: "OpenGov-365" },
  "05WMDOT": { amount: 0.5, currency: "DOT", fundingSource: "OpenGov-365" },
  "1WMDOT": { amount: 1, currency: "DOT", fundingSource: "OpenGov-365" },
  "2WMDOT": { amount: 2, currency: "DOT", fundingSource: "OpenGov-365" },
  "3WMDOT": { amount: 3, currency: "DOT", fundingSource: "OpenGov-365" },
  "5WMDOT": { amount: 5, currency: "DOT", fundingSource: "OpenGov-365" },
  "10WMDOT": { amount: 10, currency: "DOT", fundingSource: "OpenGov-365" },
  "20WMDOT": { amount: 20, currency: "DOT", fundingSource: "OpenGov-365" },
  "30WMDOT": { amount: 30, currency: "DOT", fundingSource: "OpenGov-365" },
  "50WMDOT": { amount: 50, currency: "DOT", fundingSource: "OpenGov-365" },
  "100WMDOT": { amount: 100, currency: "DOT", fundingSource: "OpenGov-365" },
  "200WMDOT": { amount: 200, currency: "DOT", fundingSource: "OpenGov-365" },
  "300WMDOT": { amount: 300, currency: "DOT", fundingSource: "OpenGov-365" },
  "500WMDOT": { amount: 500, currency: "DOT", fundingSource: "OpenGov-365" },

  "01WMUSD": { amount: 0.1, currency: "USD", fundingSource: "OpenGov-365" },
  "02WMUSD": { amount: 0.2, currency: "USD", fundingSource: "OpenGov-365" },
  "03WMUSD": { amount: 0.3, currency: "USD", fundingSource: "OpenGov-365" },
  "05WMUSD": { amount: 0.5, currency: "USD", fundingSource: "OpenGov-365" },
  "1WMUSD": { amount: 1, currency: "USD", fundingSource: "OpenGov-365" },
  "2WMUSD": { amount: 2, currency: "USD", fundingSource: "OpenGov-365" },
  "3WMUSD": { amount: 3, currency: "USD", fundingSource: "OpenGov-365" },
  "5WMUSD": { amount: 5, currency: "USD", fundingSource: "OpenGov-365" },
  "10WMUSD": { amount: 10, currency: "USD", fundingSource: "OpenGov-365" },
  "20WMUSD": { amount: 20, currency: "USD", fundingSource: "OpenGov-365" },
  "30WMUSD": { amount: 30, currency: "USD", fundingSource: "OpenGov-365" },
  "50WMUSD": { amount: 50, currency: "USD", fundingSource: "OpenGov-365" },
  "100WMUSD": { amount: 100, currency: "USD", fundingSource: "OpenGov-365" },
  "200WMUSD": { amount: 200, currency: "USD", fundingSource: "OpenGov-365" },
  "300WMUSD": { amount: 300, currency: "USD", fundingSource: "OpenGov-365" },
  "500WMUSD": { amount: 500, currency: "USD", fundingSource: "OpenGov-365" },
  "1000WMUSD": { amount: 1000, currency: "USD", fundingSource: "OpenGov-365" },
  "2000WMUSD": { amount: 2000, currency: "USD", fundingSource: "OpenGov-365" },
  "3000WMUSD": { amount: 3000, currency: "USD", fundingSource: "OpenGov-365" },
  "5000WMUSD": { amount: 5000, currency: "USD", fundingSource: "OpenGov-365" },
  "10000WMUSD": {
    amount: 10000,
    currency: "USD",
    fundingSource: "OpenGov-365",
  },

  // funding source: OpenGov-1130
  "0005WMDOTU": {
    amount: 0.005,
    currency: "DOT",
    fundingSource: "OpenGov-1130",
  },
  "001WMDOTU": { amount: 0.01, currency: "DOT", fundingSource: "OpenGov-1130" },
  "002WMDOTU": { amount: 0.02, currency: "DOT", fundingSource: "OpenGov-1130" },
  "003WMDOTU": { amount: 0.03, currency: "DOT", fundingSource: "OpenGov-1130" },
  "005WMDOTU": { amount: 0.05, currency: "DOT", fundingSource: "OpenGov-1130" },
  "01WMDOTU": { amount: 0.1, currency: "DOT", fundingSource: "OpenGov-1130" },
  "02WMDOTU": { amount: 0.2, currency: "DOT", fundingSource: "OpenGov-1130" },
  "03WMDOTU": { amount: 0.3, currency: "DOT", fundingSource: "OpenGov-1130" },
  "05WMDOTU": { amount: 0.5, currency: "DOT", fundingSource: "OpenGov-1130" },
  "1WMDOTU": { amount: 1, currency: "DOT", fundingSource: "OpenGov-1130" },
  "2WMDOTU": { amount: 2, currency: "DOT", fundingSource: "OpenGov-1130" },
  "3WMDOTU": { amount: 3, currency: "DOT", fundingSource: "OpenGov-1130" },
  "5WMDOTU": { amount: 5, currency: "DOT", fundingSource: "OpenGov-1130" },
  "10WMDOTU": { amount: 10, currency: "DOT", fundingSource: "OpenGov-1130" },
  "20WMDOTU": { amount: 20, currency: "DOT", fundingSource: "OpenGov-1130" },
  "30WMDOTU": { amount: 30, currency: "DOT", fundingSource: "OpenGov-1130" },
  "50WMDOTU": { amount: 50, currency: "DOT", fundingSource: "OpenGov-1130" },
  "100WMDOTU": { amount: 100, currency: "DOT", fundingSource: "OpenGov-1130" },
  "200WMDOTU": { amount: 200, currency: "DOT", fundingSource: "OpenGov-1130" },
  "300WMDOTU": { amount: 300, currency: "DOT", fundingSource: "OpenGov-1130" },
  "500WMDOTU": { amount: 500, currency: "DOT", fundingSource: "OpenGov-1130" },

  "01WMUSDC": { amount: 0.1, currency: "USD", fundingSource: "OpenGov-1130" },
  "02WMUSDC": { amount: 0.2, currency: "USD", fundingSource: "OpenGov-1130" },
  "03WMUSDC": { amount: 0.3, currency: "USD", fundingSource: "OpenGov-1130" },
  "05WMUSDC": { amount: 0.5, currency: "USD", fundingSource: "OpenGov-1130" },
  "1WMUSDC": { amount: 1, currency: "USD", fundingSource: "OpenGov-1130" },
  "2WMUSDC": { amount: 2, currency: "USD", fundingSource: "OpenGov-1130" },
  "3WMUSDC": { amount: 3, currency: "USD", fundingSource: "OpenGov-1130" },
  "5WMUSDC": { amount: 5, currency: "USD", fundingSource: "OpenGov-1130" },
  "10WMUSDC": { amount: 10, currency: "USD", fundingSource: "OpenGov-1130" },
  "20WMUSDC": { amount: 20, currency: "USD", fundingSource: "OpenGov-1130" },
  "30WMUSDC": { amount: 30, currency: "USD", fundingSource: "OpenGov-1130" },
  "50WMUSDC": { amount: 50, currency: "USD", fundingSource: "OpenGov-1130" },
  "100WMUSDC": { amount: 100, currency: "USD", fundingSource: "OpenGov-1130" },
  "200WMUSDC": { amount: 200, currency: "USD", fundingSource: "OpenGov-1130" },
  "300WMUSDC": { amount: 300, currency: "USD", fundingSource: "OpenGov-1130" },
  "500WMUSDC": { amount: 500, currency: "USD", fundingSource: "OpenGov-1130" },
  "1000WMUSDC": {
    amount: 1000,
    currency: "USD",
    fundingSource: "OpenGov-1130",
  },
  "2000WMUSDC": {
    amount: 2000,
    currency: "USD",
    fundingSource: "OpenGov-1130",
  },
  "3000WMUSDC": {
    amount: 3000,
    currency: "USD",
    fundingSource: "OpenGov-1130",
  },
  "5000WMUSDC": {
    amount: 5000,
    currency: "USD",
    fundingSource: "OpenGov-1130",
  },
  // Warning 🔥 the following deviates from the WMUSDC naming convention, an "M" is missing
  "10000WUSDC": {
    amount: 10000,
    currency: "USD",
    fundingSource: "OpenGov-1130",
  },
};

export type Role = "Director" | "Admin" | "Moderator" | "Member";

// Define the discord roles that have the power to trigger actions from EmojiActions
export const ROLES_WITH_POWER = ["Director"];

// the emoji that marks a post as featured
export const FEATURE_EMOJI = "WMFEATURED";

// the channel where the bot logs its actions
export const CHANNEL_LOG = "1195416315314323626";

// which channels the bot should monitor on the server
export const CHANNELS_TO_MONITOR = [
  "1191869922930868315", // #bot
  "1191801234345168917", // finders -> #nft-meta-news
];

// if true, the bot will fetch old messages from the channels it monitors when it starts
export const FETCH_OLD_MESSAGES = false;

// how many messages to fetch when the bot starts from each monitored channel
export const FETCH_OLD_MESSAGES_LIMIT = 10;

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
};

// the emojis that trigger payment actions, that in turn publish a post.

// 🚨 The following values are only used for
// the seeding the database. If you want to add a new category, you need to add it to the
// database and then add it here.

// payments are recorded and executed by another bot: https://github.com/Wag-Media/wagmi-bot
export const paymentEmojiMap: {
  [key in string]: { amount: number; currency: string };
} = {
  "005WMDOT": { amount: 0.05, currency: "DOT" },
  "01WMDOT": { amount: 0.1, currency: "DOT" },
  "02WMDOT": { amount: 0.2, currency: "DOT" },
  "03WMDOT": { amount: 0.3, currency: "DOT" },
  "05WMDOT": { amount: 0.5, currency: "DOT" },
  "1WMDOT": { amount: 1, currency: "DOT" },
  "2WMDOT": { amount: 2, currency: "DOT" },
  "3WMDOT": { amount: 3, currency: "DOT" },
  "5WMDOT": { amount: 5, currency: "DOT" },
  "10WMDOT": { amount: 10, currency: "DOT" },
  "20WMDOT": { amount: 20, currency: "DOT" },
  "30WMDOT": { amount: 30, currency: "DOT" },
  "50WMDOT": { amount: 50, currency: "DOT" },
  "100WMDOT": { amount: 100, currency: "DOT" },
  "200WMDOT": { amount: 200, currency: "DOT" },
  "300WMDOT": { amount: 300, currency: "DOT" },
  "500WMDOT": { amount: 500, currency: "DOT" },

  "1WMUSD": { amount: 1, currency: "USD" },
  "2WMUSD": { amount: 2, currency: "USD" },
  "3WMUSD": { amount: 3, currency: "USD" },
  "5WMUSD": { amount: 5, currency: "USD" },
  "10WMUSD": { amount: 10, currency: "USD" },
  "20WMUSD": { amount: 20, currency: "USD" },
  "30WMUSD": { amount: 30, currency: "USD" },
  "50WMUSD": { amount: 50, currency: "USD" },
  "100WMUSD": { amount: 100, currency: "USD" },
  "200WMUSD": { amount: 200, currency: "USD" },
  "300WMUSD": { amount: 300, currency: "USD" },
  "500WMUSD": { amount: 500, currency: "USD" },
  "1000WMUSD": { amount: 1000, currency: "USD" },
  "2000WMUSD": { amount: 2000, currency: "USD" },
  "3000WMUSD": { amount: 3000, currency: "USD" },
  "5000WMUSD": { amount: 5000, currency: "USD" },
  "10000WMUSD": { amount: 10000, currency: "USD" },
};

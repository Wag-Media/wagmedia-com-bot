export type Role = "Director" | "Admin" | "Moderator" | "Member";

// Define the discord roles that have the power to trigger actions from EmojiActions
export const ROLES_WITH_POWER = ["Director"];

// the emoji that marks a post as featured
export const FEATURE_EMOJI = "WMFEATURED";

// the channel where the bot logs its actions
export const CHANNEL_LOG = "1195416315314323626";

// which channels the bot should monitor on the server
export const CHANNELS_TO_MONITOR = ["1191869922930868315"]; //#bot];

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
  [key in string]: number;
} = {
  "005DOT": 0.05,
  "01DOT": 0.1,
  "02DOT": 0.2,
  "03DOT": 0.3,
  "05DOT": 0.5,
  "1DOT": 1,
  "2DOT": 2,
  "3DOT": 3,
  "5DOT": 5,
  "10DOT": 10,
  "20DOT": 20,
  "30DOT": 30,
  "50DOT": 50,
  "100DOT": 100,
  "200DOT": 200,
  "300DOT": 300,
  "500DOT": 500,
};

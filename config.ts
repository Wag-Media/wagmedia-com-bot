export type Role = "Director" | "Admin" | "Moderator" | "Member";

// Define the discord roles that have the power to trigger actions from EmojiActions
export const rolesWithPower = ["Director"];

// Define your valid emoji actions here
// we are not using a db enum because sqlite does not support it
export enum EmojiAction {
  publish = "publish",
  addCategory = "addCategory",
}

// which channels the bot should monitor on the server
export const CHANNELS_TO_MONITOR = ["1191869922930868315"]; //#bot];

export const EMOJI_ACTION_MAP: { [key in string]: EmojiAction } = {
  WMDEFI: EmojiAction.addCategory,
  WMDUB: EmojiAction.addCategory,
  WMNAO: EmojiAction.addCategory,
  WMNFT: EmojiAction.addCategory,
  WMOG: EmojiAction.addCategory,
  WMPARA: EmojiAction.addCategory,
  WMTA: EmojiAction.addCategory,
  WMTRS: EmojiAction.addCategory,
  WMTUT: EmojiAction.addCategory,
};

// the emojis that trigger the add category action.

// 🚨 The following values are only used for
// the seeding the database. If you want to add a new category, you need to add it to the
// database and then add it here.
export const categoryEmojiMap: {
  [key in string]: string;
} = {
  DeFi: "WMDEFI",
  Dub: "WMDUB",
  NAO: "WMNAO",
  NFT: "WMNFT",
  OG: "WMOG",
  Para: "WMPARA",
  TA: "WMTA",
  TRS: "WMTRS",
  TUT: "WMTUT",
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
  "010DOT": 0.1,
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

// define the roles and the emojis that trigger the action
export const ROLE_RIGHTS: { [key in Role]?: EmojiAction[] } = {
  Director: [EmojiAction.publish, EmojiAction.addCategory],
};

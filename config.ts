export type Role = "Director" | "Admin" | "Moderator" | "Member";
export type EmojiAction = "Publish" | "AddCategory";

export const CHANNELS_TO_MONITOR = ["1191869922930868315"]; //#bot];

// define the roles and the emojis that trigger the action
export const ROLE_RIGHTS: { [key in Role]?: EmojiAction[] } = {
  Director: ["Publish", "AddCategory"],
};

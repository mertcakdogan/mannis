import type { Character } from "./types";

/** The original procedural character. No renderer: BotEngine draws it as before. */
export const MOCHI: Character = {
  id: "mochi",
  displayName: "Mochi",
  tagline: "The original blob",
  theme: { accent: "#8B5CF6" },
  availability: {},
  renderer: null,
  reactions: {},
  fallbackPose: "idle",
};

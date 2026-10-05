import type { CompanionEventType } from "./events";

/** What a character does for an event. `pose` is an id the character's own renderer understands. */
export interface Reaction {
  pose: string;
  /** How long a one-shot reaction stays before falling back to the live state. */
  holdMs?: number;
  sound?: string;
}

export interface CharacterTheme {
  /** Optional accent; app usability never depends on it. */
  accent: string;
  /** Optional background treatment for the character's own chrome (picker, ring). */
  ring?: string;
}

export interface CharacterRenderer {
  /** Resolves pose ids to something drawable. Called once. */
  preload(onReady?: () => void): void;
  /** `pose` is a Reaction.pose; `body` is the engine's animated transform. */
  draw(ctx: CanvasRenderingContext2D, W: number, H: number, pose: string, body: BodyMotion, nowMs: number): void;
  /** Idle poses the controller may rotate through while nothing is happening. */
  idlePoses: readonly string[];
}

/** Shared spring/tween state (squash, hop, shake, roll) any renderer may apply. */
export interface BodyMotion {
  sx: number; sy: number; ox: number; oy: number; tilt: number; roll: number;
}

export interface Character {
  id: string;
  displayName: string;
  tagline?: string;
  theme: CharacterTheme;
  /** Picker avatar. Mochi has none and draws itself. */
  avatar?: string;
  availability: { default?: boolean; platforms?: readonly string[] };
  /** null = procedural Mochi engine draws it. */
  renderer: CharacterRenderer | null;
  reactions: Partial<Record<CompanionEventType, Reaction>>;
  /** Pose shown when no reaction resolves anywhere in the fallback chain. */
  fallbackPose: string;
  /** Optional per-event lines for speech UI. */
  lines?: Partial<Record<CompanionEventType, readonly string[]>>;
}

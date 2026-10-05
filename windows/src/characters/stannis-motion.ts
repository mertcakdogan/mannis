import type { Motion } from "./motion";

const breath = { amp: 0.012, hz: 0.25 };

/** How each Stannis pose moves. Quiet while he waits, sharper the worse the news. */
export const STANNIS_MOTION: Readonly<Record<string, Motion>> = {
  "idle-stand": { breathe: breath, sway: { amp: 0.01, hz: 0.12 } },
  "idle-read": { breathe: { amp: 0.01, hz: 0.22 }, sway: { amp: 0.008, hz: 0.15 } },
  "idle-lookout": { breathe: { amp: 0.01, hz: 0.22 }, sway: { amp: 0.022, hz: 0.1 } },

  "agent-started": { breathe: breath, bob: { amp: 0.012, hz: 2.5 } },
  coding: { breathe: { amp: 0.008, hz: 0.5 }, bob: { amp: 0.006, hz: 6 } },
  thinking: { breathe: breath, sway: { amp: 0.035, hz: 0.35 } },
  waiting: { breathe: breath, bob: { amp: 0.01, hz: 0.5 }, sway: { amp: 0.01, hz: 0.5 } },
  permission: { breathe: breath, hop: { amp: 0.05, everyS: 1.8 }, sway: { amp: 0.02, hz: 1 } },
  "long-task": { breathe: { amp: 0.015, hz: 0.2 }, sway: { amp: 0.006, hz: 0.1 } },
  "user-away": { breathe: { amp: 0.01, hz: 0.2 }, sway: { amp: 0.02, hz: 0.15 } },

  approval: { breathe: breath, bob: { amp: 0.02, hz: 2 } },
  denial: { breathe: breath, shake: { amp: 0.025, hz: 7, decayS: 0.5 } },
  "build-success": { breathe: breath, hop: { amp: 0.07, everyS: 1.2 } },
  "build-failed": { breathe: breath, shake: { amp: 0.02, hz: 9, decayS: 0.6 } },
  "task-completed": { breathe: breath, bob: { amp: 0.012, hz: 1.2 } },
  error: { breathe: { amp: 0.012, hz: 0.4 }, bob: { amp: 0.012, hz: 0.4 }, sway: { amp: 0.01, hz: 0.4 } },
  "git-conflict": { breathe: { amp: 0.02, hz: 1.5 }, shake: { amp: 0.012, hz: 14 } },
  notification: { breathe: breath, hop: { amp: 0.06, everyS: 2.5 } },
  angry: { breathe: { amp: 0.015, hz: 1.2 }, shake: { amp: 0.015, hz: 12 } },
};

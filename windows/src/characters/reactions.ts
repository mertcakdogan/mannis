import type { CompanionEventType } from "./events";
import type { Character, Reaction } from "./types";

/**
 * Generic fallback chain: when a character has no reaction for an event, try the
 * event's parent, then its parent's parent… and finally `idle`.
 */
export const EVENT_PARENT: Record<CompanionEventType, CompanionEventType | null> = {
  idle: null,
  agent_started: "coding",
  agent_stopped: "idle",
  agent_waiting: "idle",
  coding: "idle",
  thinking: "idle",
  permission_required: "agent_waiting",
  permission_approved: "task_completed",
  permission_denied: "error",
  build_success: "task_completed",
  build_failed: "error",
  task_completed: "idle",
  error: "idle",
  git_conflict: "error",
  notification: "idle",
  long_task: "agent_waiting",
  user_away: "idle",
  user_returned: "idle",
  annoyed: "error",
};

export function resolveReaction(character: Character, type: CompanionEventType): Reaction {
  let cursor: CompanionEventType | null = type;
  while (cursor) {
    const hit = character.reactions[cursor];
    if (hit) return hit;
    cursor = EVENT_PARENT[cursor];
  }
  return { pose: character.fallbackPose };
}

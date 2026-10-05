// Provider-independent companion events. Hook payloads, chat turns and UI
// gestures are normalised into these before any character sees them.

export const COMPANION_EVENTS = [
  "agent_started",
  "agent_stopped",
  "agent_waiting",
  "coding",
  "thinking",
  "permission_required",
  "permission_approved",
  "permission_denied",
  "build_success",
  "build_failed",
  "task_completed",
  "error",
  "git_conflict",
  "notification",
  "long_task",
  "user_away",
  "user_returned",
  "idle",
  "annoyed",
] as const;

export type CompanionEventType = (typeof COMPANION_EVENTS)[number];

export interface CompanionEvent {
  type: CompanionEventType;
  /** Who produced it: "claude", an agent tag, "opencode", "nineRouter", "ui"… */
  source: string;
  sessionId?: string;
  /** Provider-specific detail, never read by characters. */
  metadata?: Record<string, unknown>;
}

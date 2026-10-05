import { STANNIS_MOTION } from "./stannis-motion";
import { STANNIS_SPRITES } from "./stannis-frames";
import { SpriteRenderer } from "./sprite-renderer";
import type { Character } from "./types";

export const STANNIS: Character = {
  id: "stannis",
  displayName: "Stannis",
  tagline: "Few do their duty. Fewer still understand it.",
  theme: { accent: "#C9A227", ring: "#1A1512" },
  availability: { default: true },
  renderer: new SpriteRenderer(
    STANNIS_SPRITES,
    ["idle-stand", "idle-read", "idle-lookout"],
    STANNIS_MOTION,
  ),
  fallbackPose: "idle-stand",
  reactions: {
    idle: { pose: "idle-stand" },
    agent_started: { pose: "agent-started" },
    agent_waiting: { pose: "waiting" },
    coding: { pose: "coding" },
    thinking: { pose: "thinking" },
    permission_required: { pose: "permission" },
    permission_approved: { pose: "approval", holdMs: 2000 },
    permission_denied: { pose: "denial", holdMs: 2000 },
    build_success: { pose: "build-success" },
    build_failed: { pose: "build-failed" },
    task_completed: { pose: "task-completed" },
    error: { pose: "error" },
    git_conflict: { pose: "git-conflict", holdMs: 4000 },
    notification: { pose: "notification" },
    long_task: { pose: "long-task" },
    user_away: { pose: "user-away" },
    annoyed: { pose: "angry", holdMs: 2200 },
  },
};

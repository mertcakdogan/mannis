import type { ChatProvider } from "../core/chat-config";
import type { CompanionEvent } from "./events";

export interface HookInput {
  hook_event_name?: string;
  session_id?: string;
  message?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  mannis_agent?: string;
  cwd?: string;
}

const BUILD_CMD = /\b(build|compile|tsc|cargo\s+(build|check|test)|(npm|pnpm|yarn|bun)\s+(run\s+)?(build|test)|pytest|make|gradle|mvn|xcodebuild|dotnet\s+(build|test))\b/i;
const GIT_MERGE_CMD = /\bgit\s+(merge|rebase|pull|cherry-pick|stash\s+pop)\b/i;

function command(input: HookInput): string {
  const c = input.tool_input?.command;
  return typeof c === "string" ? c : "";
}

function projectOf(cwd: string | undefined): string | undefined {
  return cwd?.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || undefined;
}

/** "claude" is the untagged Claude Code relay, any other value is an agent tag. */
function sourceOf(input: HookInput): string {
  return input.mannis_agent || "claude";
}

/**
 * One hook payload → at most one companion event. Claude, Codex, Gemini and any
 * other relay-tagged agent share the same hook vocabulary, so they land on the
 * same event types; the provider only survives in `source`.
 */
export function normalizeHook(input: HookInput): CompanionEvent | null {
  const source = sourceOf(input);
  const base = { source, sessionId: input.session_id };
  const meta = (extra?: Record<string, unknown>) => ({
    metadata: { hook: input.hook_event_name, tool: input.tool_name, project: projectOf(input.cwd), ...extra },
  });
  const cmd = command(input);

  switch (input.hook_event_name) {
    case "SessionStart":
      return { type: "agent_started", ...base, ...meta() };
    case "UserPromptSubmit":
      return { type: "thinking", ...base, ...meta() };
    case "PreToolUse":
      return { type: "coding", ...base, ...meta() };
    case "PostToolUse":
      return BUILD_CMD.test(cmd)
        ? { type: "build_success", ...base, ...meta({ command: cmd }) }
        : { type: "coding", ...base, ...meta() };
    case "PostToolUseFailure":
      if (GIT_MERGE_CMD.test(cmd)) return { type: "git_conflict", ...base, ...meta({ command: cmd }) };
      if (BUILD_CMD.test(cmd)) return { type: "build_failed", ...base, ...meta({ command: cmd }) };
      return { type: "error", ...base, ...meta() };
    case "PermissionRequest":
      return { type: "permission_required", ...base, ...meta() };
    case "Notification": {
      const text = (input.message ?? "").toLowerCase();
      if (text.includes("rate limit") || text.includes("limite d")) return { type: "agent_waiting", ...base, ...meta({ reason: "rate_limit" }) };
      if (text.endsWith("?")) return { type: "agent_waiting", ...base, ...meta({ reason: "question" }) };
      return { type: "notification", ...base, ...meta() };
    }
    case "Stop":
      return { type: "task_completed", ...base, ...meta() };
    case "StopFailure":
      return { type: "error", ...base, ...meta() };
    case "SessionEnd":
      return { type: "agent_stopped", ...base, ...meta() };
    default:
      return null;
  }
}

/** In-island chat turns. OpenCode and 9router are chat backends, not session sources. */
export function normalizeChat(
  phase: "start" | "done" | "error",
  provider: ChatProvider,
): CompanionEvent {
  const type = phase === "start" ? "thinking" : phase === "done" ? "task_completed" : "error";
  return { type, source: provider, metadata: { channel: "chat" } };
}

/** Approval decisions made from the island card. */
export function normalizeDecision(decision: "allow" | "deny", sessionId?: string): CompanionEvent {
  return {
    type: decision === "allow" ? "permission_approved" : "permission_denied",
    source: "ui",
    sessionId,
  };
}

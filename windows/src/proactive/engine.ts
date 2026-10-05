import type { CompanionEvent } from "../characters/events";

/** What a suggestion offers to do. The surface that shows it decides how to ask. */
export type SuggestionAction =
  | { kind: "chat_prompt"; prompt: string }
  | { kind: "save_note"; title: string }
  | { kind: "beyin_recap" };

export interface Suggestion {
  id: "repeated_build_failure" | "save_outcome" | "permission_waiting" | "welcome_back";
  text: string;
  action: SuggestionAction;
}

export interface ProactiveDeps {
  enabled: () => boolean;
  beyinLinked: () => boolean;
  now?: () => number;
}

const FAILURES_TO_OFFER = 3;
const FAILURE_WINDOW_MS = 10 * 60_000;
const LONG_TASK_MS = 5 * 60_000;
const PERMISSION_WAIT_MS = 60_000;
const COOLDOWN_MS = 10 * 60_000;
const SHOW_MS = 45_000;

const sessionKey = (e: CompanionEvent) => `${e.source}:${e.sessionId ?? ""}`;

/**
 * Rule-based nudges from companion events. No model, no network, no timers of its
 * own: it only reacts to events and to `check()`. Each suggestion has a cool-down so
 * the companion never nags, and one shows at a time.
 */
export class ProactiveEngine {
  onChange: (() => void) | null = null;

  private active: { suggestion: Suggestion; until: number } | null = null;
  private cooldownUntil = new Map<Suggestion["id"], number>();
  private failures = new Map<string, number[]>();
  private startedAt = new Map<string, number>();
  private permissionAsked: { at: number } | null = null;

  constructor(private deps: ProactiveDeps) {}

  private now() {
    return (this.deps.now ?? (() => performance.now()))();
  }

  observe(event: CompanionEvent) {
    if (!this.deps.enabled()) return;
    const t = this.now();
    const key = sessionKey(event);
    const project = typeof event.metadata?.project === "string" ? event.metadata.project : "";

    switch (event.type) {
      case "agent_started":
      case "thinking":
      case "coding":
        if (!this.startedAt.has(key)) this.startedAt.set(key, t);
        break;
      case "build_failed": {
        const recent = (this.failures.get(key) ?? []).filter((at) => t - at < FAILURE_WINDOW_MS);
        recent.push(t);
        if (recent.length >= FAILURES_TO_OFFER) {
          this.failures.delete(key);
          this.offer({
            id: "repeated_build_failure",
            text: `The build has failed ${FAILURES_TO_OFFER} times. Want help working out why?`,
            action: { kind: "chat_prompt", prompt: "My build keeps failing. What should I check first?" },
          });
        } else {
          this.failures.set(key, recent);
        }
        break;
      }
      case "build_success":
        this.failures.delete(key);
        break;
      case "permission_required":
        this.permissionAsked = { at: t };
        break;
      case "permission_approved":
      case "permission_denied":
        this.permissionAsked = null;
        break;
      case "task_completed": {
        const began = this.startedAt.get(key);
        this.startedAt.delete(key);
        if (began !== undefined && t - began >= LONG_TASK_MS && this.deps.beyinLinked()) {
          this.offer({
            id: "save_outcome",
            text: "That was a long task. Save a note about it to Beyin?",
            action: { kind: "save_note", title: project ? `Finished: ${project}` : "Finished a long task" },
          });
        }
        break;
      }
      case "agent_stopped":
        this.startedAt.delete(key);
        this.failures.delete(key);
        break;
      case "user_returned":
        if (this.deps.beyinLinked()) {
          this.offer({
            id: "welcome_back",
            text: "Welcome back. Want a recap of recent work from Beyin?",
            action: { kind: "beyin_recap" },
          });
        }
        break;
    }
  }

  /** Call from a timer: turns a permission card left unanswered into a reminder. */
  check() {
    if (!this.deps.enabled() || !this.permissionAsked) return;
    if (this.now() - this.permissionAsked.at < PERMISSION_WAIT_MS) return;
    this.permissionAsked = null;
    this.offer({
      id: "permission_waiting",
      text: "A permission request has been waiting for a minute.",
      action: { kind: "chat_prompt", prompt: "" },
    });
  }

  /** The suggestion to show now, if any. */
  current(): Suggestion | null {
    if (this.active && this.now() >= this.active.until) this.active = null;
    return this.active?.suggestion ?? null;
  }

  /** The user waved it away or acted on it: quiet for a while. */
  dismiss() {
    if (!this.active) return;
    this.cooldownUntil.set(this.active.suggestion.id, this.now() + COOLDOWN_MS);
    this.active = null;
    this.onChange?.();
  }

  private offer(suggestion: Suggestion) {
    const t = this.now();
    if ((this.cooldownUntil.get(suggestion.id) ?? 0) > t) return;
    if (this.current()) return;
    this.cooldownUntil.set(suggestion.id, t + COOLDOWN_MS);
    this.active = { suggestion, until: t + SHOW_MS };
    this.onChange?.();
  }
}

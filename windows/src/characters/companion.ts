import type { BotStateName } from "../core/layout";
import type { CompanionEvent, CompanionEventType } from "./events";
import { resolveReaction } from "./reactions";
import { resolveCharacter } from "./registry";
import type { Character, Reaction } from "./types";

/** One-shot events: shown for a moment, then the live agent state takes over again. */
const TRANSIENT: ReadonlySet<CompanionEventType> = new Set([
  "agent_started", "agent_stopped", "permission_approved", "permission_denied",
  "build_success", "build_failed", "task_completed", "git_conflict",
  "notification", "user_returned", "annoyed", "error",
]);

const DEFAULT_HOLD_MS = 2600;
const LONG_TASK_MS = 90_000;
const AWAY_MS = 5 * 60_000;
const IDLE_ROTATE_MS = 14_000;
const SETTLE_MS = 400;

/** The agent's live state as a companion event. Presentation-neutral. */
export function eventForState(state: BotStateName): CompanionEventType {
  switch (state) {
    case "working": case "searching": return "coding";
    case "thinking": return "thinking";
    case "approval": return "permission_required";
    case "question": case "ratelimit": return "agent_waiting";
    case "error": return "error";
    case "finished": return "task_completed";
    case "sleeping": return "user_away";
    case "dizzy": return "annoyed";
    case "idle": return "idle";
  }
}

export interface CompanionDeps {
  /** Live agent state; the controller never writes to it. */
  agentState: () => BotStateName;
  characterId: () => string | undefined;
  now?: () => number;
}

/**
 * Turns events + live agent state into "what should the active character show".
 * It owns no agent lifecycle and no character rendering, so swapping the active
 * character only changes which Character the answer is resolved against.
 */
export class CompanionController {
  private transient: { type: CompanionEventType; until: number } | null = null;
  private lastActivity: number;
  private codingSince: number | null = null;
  private away = false;
  private idleIndex = 0;
  private idleSince: number;
  private changedAt = 0;
  private lastShown = "";
  onChange: (() => void) | null = null;
  private listeners = new Set<(event: CompanionEvent) => void>();

  constructor(private deps: CompanionDeps) {
    this.lastActivity = this.now();
    this.idleSince = this.lastActivity;
  }

  private now() {
    return (this.deps.now ?? (() => performance.now()))();
  }

  get character(): Character {
    return resolveCharacter(this.deps.characterId());
  }

  /** Sees every event, including the `user_returned` the controller derives itself. */
  subscribe(listener: (event: CompanionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: CompanionEvent) {
    const t = this.now();
    const returning = this.away;
    this.away = false;
    this.lastActivity = t;
    if (TRANSIENT.has(event.type)) {
      const hold = resolveReaction(this.character, event.type).holdMs ?? DEFAULT_HOLD_MS;
      this.transient = { type: event.type, until: t + hold };
    } else if (returning) {
      this.transient = { type: "user_returned", until: t + DEFAULT_HOLD_MS };
    } else {
      this.transient = null;
    }
    if (returning) this.listeners.forEach((l) => l({ type: "user_returned", source: event.source }));
    this.listeners.forEach((l) => l(event));
    this.onChange?.();
  }

  /** The event the character should currently be reacting to. */
  current(): CompanionEventType {
    const t = this.now();
    if (this.transient && t < this.transient.until) return this.transient.type;
    this.transient = null;

    const base = eventForState(this.deps.agentState());
    if (base === "coding") {
      this.codingSince ??= t;
      if (t - this.codingSince > LONG_TASK_MS) return "long_task";
    } else {
      this.codingSince = null;
    }
    if (base === "idle") {
      if (t - this.lastActivity > AWAY_MS) {
        this.away = true;
        return "user_away";
      }
    } else {
      this.lastActivity = t;
    }
    return base;
  }

  /** What to draw right now: the resolved reaction plus a rotating idle variant. */
  view(): { event: CompanionEventType; reaction: Reaction; pose: string } {
    const event = this.current();
    const character = this.character;
    const reaction = resolveReaction(character, event);
    let pose = reaction.pose;
    const variants = character.renderer?.idlePoses;
    if (event === "idle" && variants?.length) {
      const t = this.now();
      if (t - this.idleSince > IDLE_ROTATE_MS) {
        this.idleSince = t;
        this.idleIndex = (this.idleIndex + 1) % variants.length;
      }
      pose = variants[this.idleIndex];
    }
    if (event !== this.lastShown) {
      this.lastShown = event;
      this.changedAt = this.now();
    }
    return { event, reaction, pose };
  }

  /** True while a transition or one-shot is on screen, so the frame loop keeps going. */
  get animating(): boolean {
    const t = this.now();
    return (this.transient !== null && t < this.transient.until) || t - this.changedAt < SETTLE_MS;
  }
}

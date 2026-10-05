import { describe, expect, test } from "bun:test";
import { CompanionController, eventForState } from "../src/characters/companion";
import { COMPANION_EVENTS } from "../src/characters/events";
import { normalizeChat, normalizeDecision, normalizeHook } from "../src/characters/normalize";
import { resolveReaction } from "../src/characters/reactions";
import { DEFAULT_CHARACTER_ID, listCharacters, resolveCharacter } from "../src/characters/registry";
import type { Character } from "../src/characters/types";
import type { BotStateName } from "../src/core/layout";
import { DEFAULT_SETTINGS } from "../src/core/state";

const bare: Character = {
  id: "bare", displayName: "Bare", theme: { accent: "#fff" }, availability: {},
  renderer: null, reactions: {}, fallbackPose: "rest",
};

function controller(state: { v: BotStateName }, id: { v?: string }, clock = { t: 0 }) {
  return {
    clock,
    c: new CompanionController({
      agentState: () => state.v, characterId: () => id.v, now: () => clock.t,
    }),
  };
}

describe("characters", () => {
  test("default character is Stannis, and persisted default settings say so", () => {
    expect(DEFAULT_CHARACTER_ID).toBe("stannis");
    expect(DEFAULT_SETTINGS.character).toBe("stannis");
    expect(resolveCharacter(DEFAULT_SETTINGS.character).id).toBe("stannis");
  });

  test("a stored character id is honoured, unknown or missing ids fall back to Stannis", () => {
    expect(resolveCharacter("mochi").id).toBe("mochi");
    expect(resolveCharacter("nobody").id).toBe("stannis");
    expect(resolveCharacter(undefined).id).toBe("stannis");
    expect(resolveCharacter("").id).toBe("stannis");
  });

  test("registered ids are unique", () => {
    const ids = listCharacters().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("normalization", () => {
  test("permission requests from different agents become one event type", () => {
    const events = ["claude", "codex", "gemini", "opencode"].map((a) =>
      normalizeHook({
        hook_event_name: "PermissionRequest", session_id: "s",
        mannis_agent: a === "claude" ? undefined : a,
      }),
    );
    expect(events.map((e) => e?.type)).toEqual(Array(4).fill("permission_required"));
    expect(events.map((e) => e?.source)).toEqual(["claude", "codex", "gemini", "opencode"]);
    expect(events[0]?.sessionId).toBe("s");
  });

  test("hook vocabulary maps onto domain events", () => {
    const t = (h: string, extra = {}) => normalizeHook({ hook_event_name: h, ...extra })?.type;
    expect(t("SessionStart")).toBe("agent_started");
    expect(t("UserPromptSubmit")).toBe("thinking");
    expect(t("PreToolUse")).toBe("coding");
    expect(t("Stop")).toBe("task_completed");
    expect(t("StopFailure")).toBe("error");
    expect(t("SessionEnd")).toBe("agent_stopped");
    expect(t("Notification", { message: "Continue?" })).toBe("agent_waiting");
    expect(t("Notification", { message: "Hit the rate limit" })).toBe("agent_waiting");
    expect(t("Notification", { message: "Done" })).toBe("notification");
    expect(t("SomethingNew")).toBeUndefined();
  });

  test("build and git commands are recognised from tool input", () => {
    const post = (name: string, command: string) =>
      normalizeHook({ hook_event_name: name, tool_name: "Bash", tool_input: { command } })?.type;
    expect(post("PostToolUse", "npm run build")).toBe("build_success");
    expect(post("PostToolUseFailure", "cargo test --workspace")).toBe("build_failed");
    expect(post("PostToolUseFailure", "git merge feature")).toBe("git_conflict");
    expect(post("PostToolUseFailure", "ls nope")).toBe("error");
    expect(post("PostToolUse", "ls")).toBe("coding");
  });

  test("OpenCode and 9router chat turns share the same events and keep their source", () => {
    expect(normalizeChat("start", "opencode")).toMatchObject({ type: "thinking", source: "opencode" });
    expect(normalizeChat("done", "nineRouter")).toMatchObject({ type: "task_completed", source: "nineRouter" });
    expect(normalizeChat("error", "nineRouter").type).toBe("error");
    expect(normalizeChat("error", "opencode").type).toBe(normalizeChat("error", "anthropic").type);
  });

  test("approval decisions", () => {
    expect(normalizeDecision("allow").type).toBe("permission_approved");
    expect(normalizeDecision("deny").type).toBe("permission_denied");
  });
});

describe("reaction fallback", () => {
  test("character reaction wins, then the generic chain, then idle, then fallbackPose", () => {
    const c: Character = {
      ...bare,
      reactions: { error: { pose: "grim" }, idle: { pose: "calm" }, build_success: { pose: "nod" } },
    };
    expect(resolveReaction(c, "build_success").pose).toBe("nod");
    expect(resolveReaction(c, "build_failed").pose).toBe("grim"); // → error
    expect(resolveReaction(c, "git_conflict").pose).toBe("grim"); // → error
    expect(resolveReaction(c, "permission_required").pose).toBe("calm"); // → waiting → idle
    expect(resolveReaction(bare, "build_failed").pose).toBe("rest");
  });

  test("every event resolves for every registered character", () => {
    for (const c of listCharacters()) {
      for (const e of COMPANION_EVENTS) expect(resolveReaction(c, e).pose).toBeTruthy();
    }
  });
});

describe("controller", () => {
  test("agent states map to events", () => {
    expect(eventForState("approval")).toBe("permission_required");
    expect(eventForState("working")).toBe("coding");
    expect(eventForState("dizzy")).toBe("annoyed");
  });

  test("a one-shot event shows briefly, then the live state returns", () => {
    const state = { v: "working" as BotStateName };
    const { c, clock } = controller(state, {});
    c.emit({ type: "build_failed", source: "claude" });
    expect(c.current()).toBe("build_failed");
    clock.t = 10_000;
    expect(c.current()).toBe("coding");
  });

  test("switching character leaves agent state and the current event untouched", () => {
    const state = { v: "approval" as BotStateName };
    const id = { v: "stannis" as string | undefined };
    const { c } = controller(state, id);
    c.emit({ type: "build_success", source: "opencode" });
    const before = { event: c.current(), state: state.v };
    id.v = "mochi";
    expect(c.character.id).toBe("mochi");
    expect({ event: c.current(), state: state.v }).toEqual(before);
    id.v = "unknown";
    expect(c.character.id).toBe("stannis");
    expect(state.v).toBe("approval");
  });

  test("the same event renders in both characters", () => {
    const state = { v: "approval" as BotStateName };
    const id = { v: "stannis" as string | undefined };
    const { c } = controller(state, id);
    expect(c.view().event).toBe("permission_required");
    expect(c.view().pose).toBe("permission");
    id.v = "mochi";
    expect(c.view().event).toBe("permission_required");
  });

  test("long tasks and absence are detected, and activity brings the user back", () => {
    const state = { v: "working" as BotStateName };
    const { c, clock } = controller(state, {});
    c.current();
    clock.t = 100_000;
    expect(c.current()).toBe("long_task");
    state.v = "idle";
    clock.t = 100_000 + 6 * 60_000;
    expect(c.current()).toBe("user_away");
    c.emit({ type: "thinking", source: "claude" });
    expect(c.current()).toBe("user_returned");
  });
});

describe("event subscription", () => {
  test("listeners see events, and the derived user_returned comes first", () => {
    const state = { v: "idle" as BotStateName };
    const { c, clock } = controller(state, {});
    const seen: string[] = [];
    const off = c.subscribe((e) => seen.push(e.type));
    clock.t = 6 * 60_000;
    expect(c.current()).toBe("user_away");
    c.emit({ type: "thinking", source: "claude" });
    expect(seen).toEqual(["user_returned", "thinking"]);
    off();
    c.emit({ type: "coding", source: "claude" });
    expect(seen.length).toBe(2);
  });

  test("hook events carry the project folder for later features", () => {
    const e = normalizeHook({ hook_event_name: "Stop", cwd: "C:\\code\\mannis\\" });
    expect(e?.metadata?.project).toBe("mannis");
  });
});

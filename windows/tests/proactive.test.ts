import { describe, expect, test } from "bun:test";
import type { CompanionEvent, CompanionEventType } from "../src/characters/events";
import { ProactiveEngine } from "../src/proactive/engine";

function engine(opts: { enabled?: boolean; beyin?: boolean } = {}) {
  const clock = { t: 0 };
  const flags = { enabled: opts.enabled ?? true, beyin: opts.beyin ?? true };
  const e = new ProactiveEngine({
    enabled: () => flags.enabled, beyinLinked: () => flags.beyin, now: () => clock.t,
  });
  return { e, clock, flags };
}
const ev = (type: CompanionEventType, extra: Partial<CompanionEvent> = {}): CompanionEvent =>
  ({ type, source: "claude", sessionId: "s", ...extra });

describe("proactive suggestions", () => {
  test("three build failures in ten minutes offer help, two do not", () => {
    const { e, clock } = engine();
    e.observe(ev("build_failed"));
    clock.t = 60_000;
    e.observe(ev("build_failed"));
    expect(e.current()).toBeNull();
    clock.t = 120_000;
    e.observe(ev("build_failed"));
    expect(e.current()?.id).toBe("repeated_build_failure");
    expect(e.current()?.action.kind).toBe("chat_prompt");
  });

  test("failures spread over more than ten minutes, or a success in between, do not count", () => {
    const { e, clock } = engine();
    e.observe(ev("build_failed"));
    clock.t = 6 * 60_000;
    e.observe(ev("build_failed"));
    clock.t = 12 * 60_000;
    e.observe(ev("build_failed"));
    expect(e.current()).toBeNull();
    e.observe(ev("build_success"));
    e.observe(ev("build_failed"));
    e.observe(ev("build_failed"));
    expect(e.current()).toBeNull();
  });

  test("failures in different sessions are counted separately", () => {
    const { e } = engine();
    for (const s of ["a", "b", "c"]) e.observe(ev("build_failed", { sessionId: s }));
    expect(e.current()).toBeNull();
  });

  test("a long task offers a Beyin note only when Beyin is linked", () => {
    for (const beyin of [true, false]) {
      const { e, clock } = engine({ beyin });
      e.observe(ev("agent_started", { metadata: { project: "mannis" } }));
      clock.t = 6 * 60_000;
      e.observe(ev("task_completed", { metadata: { project: "mannis" } }));
      expect(e.current()?.id).toBe(beyin ? "save_outcome" : undefined);
    }
  });

  test("the note draft is titled after the project", () => {
    const { e, clock } = engine();
    e.observe(ev("coding"));
    clock.t = 6 * 60_000;
    e.observe(ev("task_completed", { metadata: { project: "mannis" } }));
    expect(e.current()?.action).toEqual({ kind: "save_note", title: "Finished: mannis" });
  });

  test("a short task offers nothing", () => {
    const { e, clock } = engine();
    e.observe(ev("coding"));
    clock.t = 60_000;
    e.observe(ev("task_completed"));
    expect(e.current()).toBeNull();
  });

  test("an unanswered permission request becomes a reminder after a minute", () => {
    const { e, clock } = engine();
    e.observe(ev("permission_required"));
    clock.t = 30_000;
    e.check();
    expect(e.current()).toBeNull();
    clock.t = 61_000;
    e.check();
    expect(e.current()?.id).toBe("permission_waiting");
  });

  test("an answered permission request never reminds", () => {
    const { e, clock } = engine();
    e.observe(ev("permission_required"));
    e.observe(ev("permission_approved"));
    clock.t = 120_000;
    e.check();
    expect(e.current()).toBeNull();
  });

  test("coming back offers a recap only with Beyin linked", () => {
    expect(engine().e.observe(ev("user_returned"))).toBeUndefined();
    const linked = engine();
    linked.e.observe(ev("user_returned"));
    expect(linked.e.current()?.action.kind).toBe("beyin_recap");
    const unlinked = engine({ beyin: false });
    unlinked.e.observe(ev("user_returned"));
    expect(unlinked.e.current()).toBeNull();
  });

  test("disabled means silent", () => {
    const { e } = engine({ enabled: false });
    for (let i = 0; i < 3; i++) e.observe(ev("build_failed"));
    expect(e.current()).toBeNull();
  });

  test("a suggestion fades, and a dismissed or shown one stays quiet for a while", () => {
    const { e, clock } = engine();
    const fail = () => { for (let i = 0; i < 3; i++) e.observe(ev("build_failed")); };
    fail();
    expect(e.current()).not.toBeNull();
    clock.t = 46_000;
    expect(e.current()).toBeNull();
    fail();
    expect(e.current()).toBeNull(); // cool-down
    clock.t = 11 * 60_000;
    fail();
    expect(e.current()).not.toBeNull();
    e.dismiss();
    expect(e.current()).toBeNull();
  });

  test("one suggestion at a time", () => {
    const { e, clock } = engine();
    e.observe(ev("permission_required"));
    clock.t = 30_000;
    for (let i = 0; i < 3; i++) e.observe(ev("build_failed"));
    expect(e.current()?.id).toBe("repeated_build_failure");
    clock.t = 61_000;
    e.check();
    expect(e.current()?.id).toBe("repeated_build_failure");
  });
});

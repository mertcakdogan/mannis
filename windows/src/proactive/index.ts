import { Companion } from "../characters";
import { State } from "../core/state";
import { ProactiveEngine } from "./engine";

export const Proactive = new ProactiveEngine({
  enabled: () => State.settings.proactive,
  beyinLinked: () => State.settings.beyinVault !== "",
});

Companion.subscribe((event) => {
  Proactive.observe(event);
  // The island sleeps when nothing happens, so the reminder needs its own wake-up.
  if (event.type === "permission_required") window.setTimeout(() => Proactive.check(), 61_000);
});

export type { Suggestion, SuggestionAction } from "./engine";

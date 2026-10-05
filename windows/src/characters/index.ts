import { State } from "../core/state";
import { CompanionController } from "./companion";

export const Companion = new CompanionController({
  agentState: () => State.effectiveState,
  characterId: () => State.settings.character,
});

export { listCharacters, resolveCharacter, DEFAULT_CHARACTER_ID } from "./registry";
export { normalizeHook, normalizeChat, normalizeDecision } from "./normalize";

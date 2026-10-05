import { MOCHI } from "./mochi";
import { STANNIS } from "./stannis";
import type { Character } from "./types";

export const DEFAULT_CHARACTER_ID = STANNIS.id;

/** Add a character here and it appears in the picker and the reaction engine. */
const REGISTRY: readonly Character[] = [STANNIS, MOCHI];

export function listCharacters(): readonly Character[] {
  return REGISTRY;
}

/** Unknown or missing ids fall back to the default character. */
export function resolveCharacter(id: string | null | undefined): Character {
  return REGISTRY.find((c) => c.id === id) ?? REGISTRY.find((c) => c.id === DEFAULT_CHARACTER_ID)!;
}

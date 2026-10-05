import { Companion } from './index';
import { resolveReaction } from './reactions';
import type { CompanionEventType } from './events';
import type { BodyMotion } from './types';

/** Draw the selected sprite at a scene anchor; false keeps procedural Mochi. */
export function drawCompanionSprite(ctx: CanvasRenderingContext2D,
  x: number, y: number, diameter: number, event: CompanionEventType,
  body: BodyMotion, nowMs: number): boolean {
  const character = Companion.character;
  const renderer = character.renderer;
  if (!renderer) return false;
  const size = diameter / 0.6;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  renderer.draw(ctx, size, size, resolveReaction(character, event).pose, body, nowMs);
  ctx.restore();
  return true;
}

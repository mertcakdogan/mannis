import { combine, enterAt, motionAt, prefersReducedMotion, REST, type Motion } from './motion';
import type { BodyMotion, CharacterRenderer } from './types';

export interface SpriteFrame { x: number; y: number; width: number; height: number; url?: string; flipX?: boolean }
export interface SpriteSource extends SpriteFrame { pose: string; url: string; flipX?: boolean; compact?: SpriteFrame }
interface Transition { shown: string; previous: string; changedAt: number }
const FADE_MS = 160;

/** Preserve aspect ratio and a common floor within the engine's 60% body slot. */
export function spritePlacement(W: number, H: number, width: number, height: number) {
  const slot = Math.min(W, H) * 0.6;
  const scale = slot / Math.max(width, height);
  return { x: -width * scale / 2, y: slot / 2 - height * scale,
    width: width * scale, height: height * scale };
}

/** Transparent atlas sprites; transitions belong to each canvas, not the character. */
export class SpriteRenderer implements CharacterRenderer {
  private images = new Map<string, HTMLImageElement>();
  private frames: ReadonlyMap<string, SpriteSource>;
  private transitions = new WeakMap<CanvasRenderingContext2D, Transition>();
  private ready = new Set<() => void>();

  constructor(
    sources: readonly SpriteSource[],
    readonly idlePoses: readonly string[],
    private motions: Readonly<Record<string, Motion>> = {},
  ) {
    this.frames = new Map(sources.map(source => [source.pose, source]));
  }

  preload(onReady?: () => void) {
    if (typeof Image === 'undefined') return;
    if (onReady) this.ready.add(onReady);
    for (const frame of this.frames.values()) {
      for (const url of [frame.url, frame.compact?.url ?? frame.url]) {
        if (this.images.has(url)) continue;
        const img = new Image();
        this.images.set(url, img);
        img.onload = img.onerror = () => this.notifyReady();
        img.src = url;
      }
    }
    this.notifyReady();
  }

  private notifyReady() {
    if ([...this.images.values()].some(img => !img.complete)) return;
    const callbacks = [...this.ready];
    this.ready.clear();
    callbacks.forEach(callback => callback());
  }

  draw(ctx: CanvasRenderingContext2D, W: number, H: number,
    pose: string, body: BodyMotion, nowMs: number) {
    this.preload();
    const frame = this.frames.get(pose) ?? this.frames.get(this.idlePoses[0]);
    if (!frame) return;
    const img = this.images.get(frame.url);
    if (!img?.complete || !img.naturalWidth) return;
    let transition = this.transitions.get(ctx);
    if (!transition) {
      transition = { shown: frame.pose, previous: '', changedAt: nowMs };
      this.transitions.set(ctx, transition);
    } else if (frame.pose !== transition.shown) {
      transition.previous = transition.shown;
      transition.shown = frame.pose;
      transition.changedAt = nowMs;
    }
    const reduced = prefersReducedMotion();
    const t = reduced ? 1 : Math.min(1, Math.max(0, (nowMs - transition.changedAt) / FADE_MS));
    const R = W * 0.3;
    const slot = Math.min(W, H) * 0.6;
    const since = nowMs - transition.changedAt;
    const m = reduced ? REST : combine(enterAt(since), motionAt(this.motions[frame.pose], since));
    ctx.save();
    ctx.translate(W / 2 + body.ox * R, H / 2 + body.oy * R);
    ctx.rotate(body.tilt + body.roll);
    ctx.scale(body.sx, body.sy);
    // Moves and scales from the feet, so breathing and hops stay on the floor.
    ctx.translate(m.dx * slot, slot / 2 + m.dy * slot);
    ctx.rotate(m.rot);
    ctx.scale(m.sx, m.sy);
    ctx.translate(0, -slot / 2);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const old = this.frames.get(transition.previous);
    if (old && t < 1) this.blit(ctx, old, W, H, 1 - t);
    this.blit(ctx, frame, W, H, old ? t : 1);
    ctx.restore();
  }

  private blit(ctx: CanvasRenderingContext2D, frame: SpriteSource, W: number, H: number, alpha: number) {
    const source = W <= 40 && frame.compact ? frame.compact : frame;
    const img = this.images.get(source.url ?? frame.url);
    if (!img?.complete || !img.naturalWidth) return;
    const p = spritePlacement(W, H, source.width, source.height);
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (source.flipX ?? frame.flipX) ctx.scale(-1, 1);
    ctx.drawImage(img, source.x, source.y, source.width, source.height, p.x, p.y, p.width, p.height);
    ctx.restore();
  }
}

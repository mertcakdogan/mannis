// Procedural motion for sprite characters. One still per pose is enough when each
// pose has its own way of moving: this module turns a small declarative spec into
// a transform, so a character describes *how* a pose moves and never touches canvas.
//
// Offsets are fractions of the character's slot; rotations are radians; time is
// measured from the moment the pose appeared.

export interface Motion {
  /** Rise and fall of the chest, anchored at the feet. */
  breathe?: { amp: number; hz: number };
  /** Gentle vertical bounce, e.g. typing. */
  bob?: { amp: number; hz: number };
  /** Side-to-side rotation, e.g. thinking. */
  sway?: { amp: number; hz: number };
  /** Horizontal shake. `decayS` makes it die down, e.g. a head-shake for "no". */
  shake?: { amp: number; hz: number; decayS?: number };
  /** A jump every `everyS` seconds. */
  hop?: { amp: number; everyS: number };
}

export interface Transform {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
  rot: number;
}

export const REST: Transform = { dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };

const TAU = Math.PI * 2;
const HOP_SHARE = 0.3;

/** The pose's own motion `sinceMs` after it appeared. */
export function motionAt(m: Motion | undefined, sinceMs: number): Transform {
  if (!m) return REST;
  const t = sinceMs / 1000;
  let { dx, dy, sx, sy, rot } = REST;
  if (m.breathe) {
    const wave = Math.sin(TAU * m.breathe.hz * t);
    sy += m.breathe.amp * wave;
    sx -= m.breathe.amp * 0.5 * wave;
  }
  if (m.bob) dy += m.bob.amp * Math.sin(TAU * m.bob.hz * t);
  if (m.sway) rot += m.sway.amp * Math.sin(TAU * m.sway.hz * t);
  if (m.shake) {
    const fade = m.shake.decayS ? Math.exp(-t / m.shake.decayS) : 1;
    dx += m.shake.amp * fade * Math.sin(TAU * m.shake.hz * t);
  }
  if (m.hop) {
    const u = (t % m.hop.everyS) / m.hop.everyS;
    if (u < HOP_SHARE) dy -= m.hop.amp * Math.sin((Math.PI * u) / HOP_SHARE);
  }
  return { dx, dy, sx, sy, rot };
}

/** Squash-and-settle played every time a new pose appears. */
export function enterAt(sinceMs: number): Transform {
  const e = Math.max(0, sinceMs) / 1000;
  const env = Math.exp(-7 * e);
  const wobble = Math.cos(20 * e);
  return {
    dx: 0,
    dy: -0.05 * env * Math.abs(Math.sin(16 * e)),
    sx: 1 + 0.08 * env * wobble,
    sy: 1 - 0.12 * env * wobble,
    rot: 0,
  };
}

export function combine(a: Transform, b: Transform): Transform {
  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    sx: a.sx * b.sx,
    sy: a.sy * b.sy,
    rot: a.rot + b.rot,
  };
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

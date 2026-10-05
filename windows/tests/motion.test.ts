import { describe, expect, test } from "bun:test";
import { combine, enterAt, motionAt, REST } from "../src/characters/motion";
import { STANNIS_SPRITES } from "../src/characters/stannis-frames";
import { STANNIS_MOTION } from "../src/characters/stannis-motion";

describe("motion", () => {
  test("no spec means no movement", () => {
    expect(motionAt(undefined, 1234)).toEqual(REST);
    expect(motionAt({}, 1234)).toEqual(REST);
  });

  test("breathing is periodic and moves the chest up and down from the feet", () => {
    const m = { breathe: { amp: 0.02, hz: 0.5 } };
    expect(motionAt(m, 0).sy).toBeCloseTo(1);
    expect(motionAt(m, 500).sy).toBeCloseTo(1.02); // quarter period: fully in
    expect(motionAt(m, 1500).sy).toBeCloseTo(0.98); // fully out
    expect(motionAt(m, 2000).sy).toBeCloseTo(1); // back after one period
    expect(motionAt(m, 500).sx).toBeLessThan(1); // narrower while taller
  });

  test("a decaying shake dies down, a plain shake does not", () => {
    const peak = (spec: object, from: number) => {
      let max = 0;
      for (let ms = from; ms < from + 400; ms += 5) max = Math.max(max, Math.abs(motionAt(spec, ms).dx));
      return max;
    };
    const decaying = { shake: { amp: 0.02, hz: 8, decayS: 0.4 } };
    expect(peak(decaying, 0)).toBeGreaterThan(0.01);
    expect(peak(decaying, 3000)).toBeLessThan(0.0005);
    expect(peak({ shake: { amp: 0.02, hz: 8 } }, 3000)).toBeGreaterThan(0.015);
  });

  test("a hop leaves the floor briefly and is on the floor the rest of the time", () => {
    const m = { hop: { amp: 0.06, everyS: 2 } };
    expect(motionAt(m, 300).dy).toBeLessThan(-0.05); // mid-air
    expect(motionAt(m, 1000).dy).toBe(0); // resting
    expect(motionAt(m, 2300).dy).toBeLessThan(-0.05); // next hop
  });

  test("a new pose pops in and settles", () => {
    expect(enterAt(0).sy).toBeLessThan(0.9);
    const settled = enterAt(1500);
    expect(settled.sx).toBeCloseTo(1, 2);
    expect(settled.sy).toBeCloseTo(1, 2);
    expect(settled.dy).toBeCloseTo(0, 2);
  });

  test("combining multiplies scales and adds offsets", () => {
    const c = combine({ dx: 0.1, dy: 0, sx: 2, sy: 1, rot: 0.1 }, { dx: 0.2, dy: 0.1, sx: 1.5, sy: 1, rot: 0.2 });
    expect(c.dx).toBeCloseTo(0.3);
    expect(c.sx).toBe(3);
    expect(c.rot).toBeCloseTo(0.3);
  });
});

describe("Stannis motion", () => {
  test("every pose has its own motion", () => {
    for (const frame of STANNIS_SPRITES) expect(STANNIS_MOTION[frame.pose]).toBeDefined();
  });

  test("no pose can move far enough to leave its canvas", () => {
    for (const [pose, spec] of Object.entries(STANNIS_MOTION)) {
      for (let ms = 0; ms < 6000; ms += 7) {
        const t = combine(enterAt(ms), motionAt(spec, ms));
        expect(Math.abs(t.dx), pose).toBeLessThan(0.08);
        expect(Math.abs(t.dy), pose).toBeLessThan(0.14);
        expect(Math.abs(t.rot), pose).toBeLessThan(0.07);
        expect(t.sx, pose).toBeGreaterThan(0.85);
        expect(t.sx, pose).toBeLessThan(1.12);
        expect(t.sy, pose).toBeGreaterThan(0.85);
        expect(t.sy, pose).toBeLessThan(1.15);
      }
    }
  });
});

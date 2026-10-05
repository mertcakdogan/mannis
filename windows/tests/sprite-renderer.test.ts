import { expect, test } from 'bun:test';
import { spritePlacement } from '../src/characters/sprite-renderer';
test('wide and tall poses fit the same slot without clipping', () => {
 for(const [width,height] of [[300,180],[150,280]]) {
  const p=spritePlacement(100,100,width,height);
  expect(p.width).toBeLessThanOrEqual(60);
  expect(p.height).toBeLessThanOrEqual(60);
  expect(p.width/p.height).toBeCloseTo(width/height);
  expect(p.y+p.height).toBeCloseTo(30);
 }
});

import { STANNIS_SPRITES } from '../src/characters/stannis-frames';
import { STANNIS } from '../src/characters/stannis';
import { COMPANION_EVENTS } from '../src/characters/events';
import { resolveReaction } from '../src/characters/reactions';
test('all Stannis reactions use bounded regions of the transparent packaged atlas', async () => {
 const header=new Uint8Array(await Bun.file('public/characters/stannis/full-body-atlas.png').arrayBuffer());
 expect(header[25]).toBe(6); // PNG RGBA, rather than the old opaque RGB board crops.
 const view=new DataView(header.buffer);
 const width=view.getUint32(16), height=view.getUint32(20);
 const ids=new Set(STANNIS_SPRITES.map(frame=>frame.pose));
 for(const event of COMPANION_EVENTS)expect(ids.has(resolveReaction(STANNIS,event).pose)).toBe(true);
 for(const frame of STANNIS_SPRITES){
  expect(frame.x).toBeGreaterThanOrEqual(0);expect(frame.y).toBeGreaterThanOrEqual(0);
  expect(frame.x+frame.width).toBeLessThanOrEqual(width);
  expect(frame.y+frame.height).toBeLessThanOrEqual(height);
  expect(frame.url).toBe('/characters/stannis/full-body-atlas.png');
 }
 for(let i=0;i<STANNIS_SPRITES.length;i++)for(let j=i+1;j<STANNIS_SPRITES.length;j++){
  const a=STANNIS_SPRITES[i],b=STANNIS_SPRITES[j];
  expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);
 }
});

test("compact frames use head-and-shoulders crops while normal frames keep their full bounds", () => {
 for (const frame of STANNIS_SPRITES) {
  expect(frame.compact).toBeTruthy();
  expect(frame.compact?.x).toBeGreaterThanOrEqual(0);
  expect(frame.compact?.y).toBeGreaterThanOrEqual(0);
  expect(frame.compact?.width).toBe(frame.compact?.height);
 }
 for (const frame of STANNIS_SPRITES) {
  const c = frame.compact;
  expect(c).toBeDefined();
  if (!c) continue;
  expect(c.url).toBe('/characters/stannis/atlas.png');
  expect(c.x + c.width).toBeLessThanOrEqual(1122);
  expect(c.y + c.height).toBeLessThanOrEqual(1402);
  if (frame.pose === 'error') {
   // Measured right edge of the portrait's hair, clipped by the old 0.82 crop.
   expect(c.x + c.width).toBeGreaterThanOrEqual(1083);
  }
  if (frame.pose === 'idle-stand') {
   expect(frame.height).toBe(278);
   expect(frame.width).toBe(172);
  }
 }
 expect(spritePlacement(33, 73, 120, 130).height).toBeLessThanOrEqual(20);
});

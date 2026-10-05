import type { SpriteFrame, SpriteSource } from './sprite-renderer';

// Measured bust bounds on the transparent 1122 × 1402 portrait atlas.
// Compact squares contain each whole bust, including hair and chin padding.
// Larger body slots use the separate full-figure atlas and original measured bounds.
const PORTRAITS: readonly (readonly [pose: string, x: number, y: number, width: number, height: number])[] = [
  ['idle-stand', 34, 25, 208, 247],
  ['agent-started', 309, 25, 244, 248],
  ['coding', 584, 26, 224, 246],
  ['permission', 856, 25, 252, 248],
  ['build-success', 26, 303, 252, 243],
  ['build-failed', 304, 303, 249, 242],
  ['task-completed', 588, 303, 230, 241],
  ['git-conflict', 855, 303, 252, 241],
  ['notification', 23, 572, 255, 245],
  ['thinking', 320, 582, 220, 236],
  ['waiting', 578, 582, 245, 232],
  ['error', 851, 591, 232, 223],
  ['long-task', 22, 855, 247, 242],
  ['user-away', 309, 847, 218, 274],
  ['angry', 583, 848, 239, 246],
  ['approval', 859, 851, 220, 245],
  ['denial', 33, 1124, 222, 242],
  ['idle-read', 306, 1121, 234, 246],
  ['idle-lookout', 595, 1125, 218, 247],
];

const URL = '/characters/stannis/atlas.png';

const FULL: readonly (readonly [pose: string, x: number, y: number, width: number, height: number])[] = [
  ['idle-stand', 75, 26, 172, 278],
  ['agent-started', 333, 55, 211, 247],
  ['coding', 594, 56, 210, 244],
  ['permission', 882, 32, 203, 271],
  ['build-success', 50, 323, 243, 229],
  ['build-failed', 325, 323, 231, 228],
  ['task-completed', 596, 323, 206, 230],
  ['git-conflict', 872, 329, 204, 224],
  ['notification', 40, 581, 271, 235],
  ['thinking', 356, 558, 155, 267],
  ['waiting', 589, 587, 220, 230],
  ['error', 876, 589, 196, 228],
  ['long-task', 32, 848, 290, 248],
  ['user-away', 359, 841, 155, 254],
  ['angry', 588, 861, 232, 229],
  ['approval', 871, 836, 192, 259],
  ['denial', 62, 1107, 183, 270],
  ['idle-read', 338, 1116, 216, 258],
  ['idle-lookout', 616, 1104, 161, 274],
];

const compactFrames: ReadonlyMap<string, SpriteFrame> = new Map(PORTRAITS.map(([pose, x, y, width, height]) => {
  const side = Math.max(width, height) + 4;
  return [pose, { url: URL, x: Math.round(x - (side - width) / 2),
    y: Math.round(y - (side - height) / 2), width: side, height: side, flipX: false }];
}));

export const STANNIS_SPRITES: readonly SpriteSource[] = FULL.map(([pose, x, y, width, height]) => ({
  pose, url: '/characters/stannis/full-body-atlas.png', x, y, width, height,
  flipX: pose === 'denial', compact: compactFrames.get(pose),
}));

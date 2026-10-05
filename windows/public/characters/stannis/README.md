# Stannis sprites

`atlas.png` is a 1122 × 1402 RGBA sprite atlas: a 4 × 5 grid of chest-up busts in a
soft "mochi" style (large rounded head, thick clean outline), generated with imagegen from
the user-supplied `Stannis Chibi Karakter Tasarım Panosu.png` design board and chroma-keyed
to transparency. It keeps the board's character (receding dark hair, stern brows, black
armour with the gold stag, black-and-gold cloak) but is a new drawing, not a cut of the board.

The runtime uses the 19 measured frames in `src/characters/stannis-frames.ts`; the last
cell repeats the standing pose and is unused. Small body slots (24 px or less) use
a square containing each whole bust, including hair, chin and transparent padding.
How each pose moves is declared in `src/characters/stannis-motion.ts`.

`full-body-atlas.png` packages the original transparent full-figure adaptation of
the same design board. Body slots above 24 px, including 44–62 px previews, use
that atlas with the original measured bounds. Both atlases are preloaded once.
The raw green-screen sheet stays outside the build under `.qa/stannis-mochi/`.

Preview every reaction and native size at `/dev/stannis-preview.html` under Vite.
Exercise the real island, greeting, upload, task minis and picker at
`/dev/companion-island-preview.html` (append `#compact`, `#coding`, … to run a button on
load). Preview fixtures never call chat services or persist settings and are excluded from
the production HTML build.

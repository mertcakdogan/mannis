# Mannis Windows settings design

## 1. Atmosphere & Identity
Preserve the shipped quiet dark settings window and Mochi identity. Add model
connections to existing controls. Branding is reserved for a later discussion.
Source: src/settings/settings.css and src/views/dom.ts. Primary user: a Windows
developer configuring a local AI server.

## 2. Color
Reuse --bg (#0b0c0e), --card (#141518), --ink (#f5f6f8), --dim (#9398a1),
--dim-2 (#6b7079), --hairline (white at 7%), --green (#22c55e), --red
(#f4505e), --amber (#f5a524). Reuse existing notice classes for status feedback.

## 3. Typography
Reuse --font (system-ui, Segoe UI Variable Text, Segoe UI, sans-serif) and
--mono (Cascadia Mono, Consolas, ui-monospace, monospace).
Existing scale: title 17px/600; section 13px/600; body 13px/1.45;
controls 12.5px; hint 12px; code 11.5px. Do not restyle existing text.

## 4. Spacing & Layout
Settings: vertical stack, max-width 720px, padding 22px 24px 32px, gap 18px.
Sections: 16px 18px padding, 12px gap, 14px radius and hairline border.
Rows: wrapping flex clusters, 12px gaps; labels: 132px minimum width.
New fields grow/wrap with min-width:0. Verify 375, 460 (native minimum),
560 (native default), 768 and 1280px widths. The document owns vertical scrolling.

## 5. Components
Reuse typed h()/clear() DOM helpers, section/h2, row/label, native input/select,
primary/danger buttons, hint, path and notice primitives.
Buttons: rest, hover, active, focus, disabled. Connection section: Anthropic,
OpenCode, 9router, empty model, loading, connected, failed, saving, saved.
Labels use for/id. Status uses aria-live. Failures retain inputs. Saving a
provider selection resets conversation history; no automatic message sends.

## 6. Motion & Interaction
Reuse existing button background 140ms and press transform 80ms transitions.
New controls add no animation and respect prefers-reduced-motion.
Models load automatically after an explicit credential save and when opening a
provider with an existing saved credential, as requested by the user. Reload remains
available. A native dropdown offers discovered models; a custom model field handles
aliases/combos. Loading disables conflicting controls and never selects a provider.

## 7. Depth & Surface
Reuse tonal separation and hairline borders. No new shadows or assets.
Native select retains dark color-scheme.

## 8. Accessibility Constraints & Accepted Debt
New controls have labels, keyboard access, visible focus, readable notices and
text explanations. Passwords clear after saving and are never read back.
Long errors wrap. Preserve existing controls outside this change.
No new debt accepted. Native credentials and desktop behavior need native QA.

## Companion asset correction
Integration minis use static, service-specific SVG symbols in their existing 24px
pill and 13px compact slots, tinted with the existing task color. Email, workflow,
deployment, Git, notes, calendar, payment and editor symbols have distinct shapes.
Agent minis use the selected companion and state reaction. Compact Stannis crops
are square head-and-shoulders regions with hair, chin and shoulder padding; only
body slots of 24px or less use these crops. Larger figures keep their full bounds.
Static integration symbols own no animation engine or timer.

Stannis now uses a transparent atlas adapted from the user's Stannis chibi board.
Preserve the receding brown-grey hair, stern face, black armor, gold stag and cloak.
Use measured source rectangles; never use the presentation board as a portrait or
clip the character into a circle. Contain each entire silhouette in the existing
60% canvas body slot, with a stable floor. State text and badges remain readable
independently of sprite detail. The picker, island, greeting, task minis and upload
scene share the selected character; Mochi retains its procedural renderer.
Transitions are per canvas (160 ms) and skip fading under reduced-motion preference.
No permanent extra frame loop is introduced for Stannis.

## Mannis visual layer additions
Proactive suggestions use a quiet amber marker in compact mode and a small action card only in expanded mode. The card is dismissible and every action requires an explicit click. Chat, Beyin note and recap surfaces reuse existing island cards and controls. Stannis body slots up to 24px use complete portraits from `atlas.png`; expanded silhouettes use the original full figures in `full-body-atlas.png`. Each source is contained in its slot, with no circular face clipping. Settings Companion and Beyin sections keep the existing dark Settings tokens, add keyboard focus and radiogroup arrow navigation, and stop transitions under reduced motion. The Tauri icon filenames and bundle identifiers remain unchanged; `scripts/gen-icons.mjs` now renders the Mannis palette and Stannis bust into the same PNG/ICO outputs.

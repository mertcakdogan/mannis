import { listCharacters, resolveCharacter } from '../characters';
import type { Character } from '../characters/types';
import type { Settings } from '../core/state';
import { h } from '../views/dom';

function avatarFor(character: Character): HTMLElement {
  const renderer = character.renderer;
  if (renderer) {
    const canvas = document.createElement('canvas');
    canvas.className = 'avatar';
    canvas.width = canvas.height = 128;
    canvas.setAttribute('aria-hidden', 'true');
    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, 64, 64);
      const size = 56 / 0.6;
      ctx.translate((64 - size) / 2, (64 - size) / 2);
      renderer.draw(ctx, size, size, character.fallbackPose,
        { sx: 1, sy: 1, ox: 0, oy: 0, tilt: 0, roll: 0 }, performance.now());
    };
    renderer.preload(draw);
    return canvas;
  }
  return character.avatar
    ? h('img', { class: 'avatar', src: character.avatar, alt: '' })
    : h('span', { class: 'avatar placeholder', text: character.displayName.slice(0, 1) });
}

export function companionSection(
  getSettings: () => Settings,
  select: (id: string) => void,
  setProactive: (on: boolean) => void,
): HTMLElement {
  const list = h('div', { class: 'characters', role: 'radiogroup', 'aria-label': 'Companion' });
  const render = () => {
    const active = resolveCharacter(getSettings().character).id;
    list.replaceChildren(...listCharacters().map(character => {
      const on = character.id === active;
      const card = h('button', {
        class: on ? 'character on' : 'character', role: 'radio',
        'aria-checked': String(on), tabindex: on ? '0' : '-1', style: `--accent:${character.theme.accent}`,
      }, avatarFor(character), h('span', { class: 'name', text: character.displayName }),
      on ? h('span', { class: 'hint', text: 'Active' }) : '');
      card.addEventListener('click', () => { select(character.id); render(); });
      return card;
    }));
  };
  list.addEventListener("keydown", (event) => {
    if (!(event instanceof KeyboardEvent) || !["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const cards = [...list.querySelectorAll<HTMLButtonElement>("button")];
    const current = cards.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    cards[(current + delta + cards.length) % cards.length]?.focus();
  });
  render();
  const nudges = h('input', { type: 'checkbox', id: 'proactive' }) as HTMLInputElement;
  nudges.checked = getSettings().proactive;
  nudges.addEventListener('change', () => setProactive(nudges.checked));
  return h('section', { class: 'companion-section' }, h('h2', {}, h('span', { text: 'Companion' })), list,
    h('div', { class: 'row' }, h('label', { for: 'proactive', text: 'Suggestions' }), nudges,
      h('span', { class: 'hint', text: 'Occasional nudges, e.g. after repeated build failures. Rule-based; nothing is sent anywhere.' })));
}

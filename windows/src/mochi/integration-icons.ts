import { svg } from '../views/dom';

/** Service symbols on the same 24px grid as the island's existing icons. */
const SYMBOLS: ReadonlyMap<string, string> = new Map([
  ['integration_claude', 'M9 5 2 12l7 7M15 5l7 7-7 7'],
  ['integration_resend', 'M3 5h18v14H3zM3 6l9 7 9-7'],
  ['integration_n8n', 'M7 12h4l4-6h2M11 12l4 6h2M7 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0M23 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0'],
  ['integration_vercel', 'M12 3 23 21H1z'],
  ['integration_github', 'M6 8v8M8 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M20 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M18 8v2c0 4-12 0-12 6'],
  ['integration_notion', 'M4 3h16v18H4zM8 17V7l8 10V7'],
  ['integration_calcom', 'M3 6h18v15H3zM7 3v6M17 3v6M3 11h18M8 15h2M14 15h2'],
  ['integration_stripe', 'M3 5h18v14H3zM3 10h18M6 15h4'],
]);

export function integrationSymbol(id: string): string | undefined {
  return SYMBOLS.get(id);
}

export function createIntegrationIcon(id: string, size: number): SVGSVGElement | null {
  const path = integrationSymbol(id);
  if (!path) return null;
  const icon = svg(path, Math.min(size, 18), { stroke: 1.8 });
  icon.classList.add('integration-symbol');
  return icon;
}

export type ChatProvider = 'anthropic' | 'opencode' | 'nineRouter';

export interface ChatSettings {
  readonly chatProvider: ChatProvider;
  readonly opencodeUrl: string;
  readonly opencodeUsername: string;
  readonly opencodeModel: string;
  readonly nineRouterUrl: string;
  readonly nineRouterModel: string;
}

export const DEFAULT_CHAT_SETTINGS = {
  chatProvider: 'anthropic',
  opencodeUrl: 'http://127.0.0.1:4096',
  opencodeUsername: 'opencode',
  opencodeModel: '',
  nineRouterUrl: 'http://127.0.0.1:20128/v1',
  nineRouterModel: '',
} as const satisfies ChatSettings;

export function providerDetails(provider: ChatProvider) {
  switch (provider) {
    case 'anthropic':
      return { name: 'Claude', credential: 'anthropic-api-key', label: 'API key' };
    case 'opencode':
      return { name: 'OpenCode', credential: 'opencode-server-password', label: 'Server password (optional)' };
    case 'nineRouter':
      return { name: '9router', credential: 'nine-router-api-key', label: 'API key (optional)' };
    default:
      return assertNever(provider);
  }
}

export function chatConnectionKey(settings: ChatSettings & { readonly model: string }): string {
  switch (settings.chatProvider) {
    case 'anthropic':
      return JSON.stringify(['anthropic', settings.model]);
    case 'opencode':
      return JSON.stringify(['opencode', settings.opencodeUrl, settings.opencodeUsername, settings.opencodeModel]);
    case 'nineRouter':
      return JSON.stringify(['nineRouter', settings.nineRouterUrl, settings.nineRouterModel]);
    default:
      return assertNever(settings.chatProvider);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown chat provider: ${String(value)}`);
}

export interface ModelChoice {
  readonly id: string;
  readonly name: string;
}

export function modelChoices(models: readonly ModelChoice[], selected: string): readonly ModelChoice[] {
  if (!selected || models.some(entry => entry.id === selected)) return models;
  return [{ id: selected, name: selected }, ...models];
}

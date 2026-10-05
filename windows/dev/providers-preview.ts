import '../src/settings/settings.css';
import { providerSection } from '../src/settings/providers';
import { DEFAULT_SETTINGS, type Settings } from '../src/core/state';
import { h } from '../src/views/dom';

const root = document.getElementById('settings-root');
if (!root) throw new TypeError('Missing preview root');
let settings: Settings = { ...DEFAULT_SETTINGS };
const scenario = h('select', { id: 'scenario' },
  h('option', { value: 'success', text: 'Success' }),
  h('option', { value: 'error', text: 'Connection error' }),
  h('option', { value: 'slow', text: 'Loading (finish with button)' }),
  h('option', { value: 'save-error', text: 'Save error' }),
  h('option', { value: 'saved-key', text: 'Saved credential on provider open' }),
  h('option', { value: 'empty', text: 'Empty models' }),
);
let credentialSaved = false;
let modelRequests = 0;
const requests = h('p', { class: 'hint', id: 'model-requests', text: 'Model requests: 0' });
const stored = h('pre', { class: 'path', id: 'saved-state', text: 'No connection saved.' });
const finish = h('button', { text: 'Finish pending connection' });
let resolvePending: (() => void) | undefined;
finish.addEventListener('click', () => { resolvePending?.(); });
root.append(h('h1', { text: 'Connection QA preview' }),
  h('p', { class: 'hint', text: 'Development-only fixtures. No servers, real credentials or settings are changed.' }),
  h('div', { class: 'row' }, h('label', { for: 'scenario', text: 'Test scenario' }), scenario, finish),
  providerSection(() => settings, async (next) => {
    if (scenario.value === 'save-error') throw new Error('Preview: settings could not be written.');
    settings = next;
    stored.textContent = JSON.stringify({ provider: next.chatProvider,
      model: next.chatProvider === 'opencode' ? next.opencodeModel : next.nineRouterModel });
  }, {
    secretPresent: async () => credentialSaved || scenario.value === 'saved-key',
    secretSet: async () => { credentialSaved = true; },
    secretClear: async () => { credentialSaved = false; },
    chatModels: async () => {
      requests.textContent = `Model requests: ${++modelRequests}`;
      if (scenario.value === 'empty') return [];
      if (scenario.value === 'error') throw new Error('Preview: server is unreachable. Check the server URL and start the service.');
      if (scenario.value === 'slow') await new Promise<void>((resolve) => { resolvePending = resolve; });
      return [
        { id: 'local/test-free', name: 'Preview free model' },
        { id: 'local/test-paid', name: 'Preview paid model' },
      ];
    },
  }), requests, stored);

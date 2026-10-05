import { Bridge } from '../core/bridge';
import { modelChoices, providerDetails, type ChatProvider, type ModelChoice } from '../core/chat-config';
import type { Settings } from '../core/state';
import { clear, h } from '../views/dom';

type ConnectionServices = Pick<typeof Bridge, 'secretPresent' | 'secretSet' | 'secretClear' | 'chatModels'>;

export function providerSection(
  getSettings: () => Settings,
  saveSettings: (settings: Settings) => Promise<void>,
  services: ConnectionServices = Bridge,
): HTMLElement {
  const provider = h('select', { id: 'chat-provider' });
  provider.append(
    h('option', { value: 'anthropic', text: 'Claude (Anthropic)' }),
    h('option', { value: 'opencode', text: 'OpenCode' }),
    h('option', { value: 'nineRouter', text: '9router' }),
  );
  provider.value = getSettings().chatProvider;
  const body = h('div', { class: 'provider-fields' });
  const feedback = h('div', { 'aria-live': 'polite', role: 'status' });
  const section = h('section', { class: 'provider-settings' },
    h('h2', { text: 'Chat connection' }),
    row('Provider', provider), body, feedback,
  );
  let busy = false;
  let revision = 0;

  function show(text: string, error = false) {
    clear(feedback);
    feedback.append(h('div', { class: `notice ${error ? 'err' : 'ok'}`, text }));
  }

  function draw() {
    const renderedRevision = ++revision;
    clear(body);
    clear(feedback);
    const selected = selectedProvider(provider.value);
    const settings = getSettings();
    if (selected === 'anthropic') {
      body.append(h('p', { class: 'hint', text: 'Uses the Claude API key and model below.' }));
      const save = h('button', { class: 'primary', text: 'Use Claude for chat' });
      save.addEventListener('click', async () => {
        save.disabled = true;
        try {
          await saveSettings({ ...getSettings(), chatProvider: selected });
          show('Claude selected. Your next message uses Claude.');
        } catch (error) {
          show(errorText(error), true);
        } finally {
          save.disabled = false;
        }
      });
      body.append(save);
      return;
    }

    const isOpenCode = selected === 'opencode';
    const detail = providerDetails(selected);
    const url = h('input', { id: 'chat-endpoint', type: 'text', spellcheck: 'false',
      autocomplete: 'off', 'aria-describedby': 'chat-help' });
    url.value = isOpenCode ? settings.opencodeUrl : settings.nineRouterUrl;
    const username = h('input', { id: 'chat-username', type: 'text', autocomplete: 'off' });
    username.value = settings.opencodeUsername;
    const model = h('input', { id: 'chat-model', type: 'text',
      placeholder: isOpenCode ? 'Server default, or provider/model' : 'Select a model from your router',
      spellcheck: 'false', autocomplete: 'off' });
    model.value = isOpenCode ? settings.opencodeModel : settings.nineRouterModel;
    const models = h('select', { id: 'chat-models' });
    const customRow = row('Custom model', model);
    let discovered: readonly ModelChoice[] = [];
    function renderModels() {
      clear(models);
      models.append(h('option', { value: '', text: isOpenCode ? 'Server default' : 'Choose a model…' }));
      for (const entry of modelChoices(discovered, model.value)) {
        models.append(h('option', { value: entry.id, text: entry.name === entry.id ? entry.id : `${entry.name} — ${entry.id}` }));
      }
      const custom = h('option', { value: 'custom', text: 'Custom model / combo…' });
      custom.dataset.manual = 'true';
      models.append(custom);
      models.value = model.value;
      customRow.hidden = true;
    }
    renderModels();
    const password = h('input', { id: 'chat-credential', type: 'password',
      autocomplete: 'new-password', placeholder: 'Leave blank to keep the saved credential' });
    const credentialState = h('p', { class: 'hint', text: 'Credentials stay in the OS credential store.' });
    const connect = h('button', { text: 'Reload models' });
    const saveKey = h('button', { text: 'Save key & load models' });
    const save = h('button', { class: 'primary', text: 'Save connection' });
    const remove = h('button', { class: 'danger', text: 'Remove credential' });
    const controls = [provider, url, username, model, models, password, connect, saveKey, save, remove];
    function updateButtons() {
      saveKey.disabled = busy || !password.value;
      save.disabled = busy || (!isOpenCode && !model.value.trim());
    }
    password.addEventListener("input", updateButtons);
    model.addEventListener("input", updateButtons);
    models.addEventListener("change", () => {
      const custom = models.selectedOptions[0]?.dataset.manual === "true";
      customRow.hidden = !custom;
      if (custom) model.focus();
      else model.value = models.value;
      updateButtons();
    });
    updateButtons();
    const snapshot = (): Settings => isOpenCode
      ? { ...getSettings(), chatProvider: selected, opencodeUrl: url.value.trim(),
        opencodeUsername: username.value.trim(), opencodeModel: model.value.trim() }
      : { ...getSettings(), chatProvider: selected, nineRouterUrl: url.value.trim(),
        nineRouterModel: model.value.trim() };

    async function act(action: () => Promise<void>) {
      if (busy) return;
      busy = true;
      for (const control of controls) control.disabled = true;
      section.setAttribute('aria-busy', 'true');
      try {
        await action();
      } catch (error) {
        show(errorText(error), true);
      } finally {
        busy = false;
        for (const control of controls) control.disabled = false;
        section.removeAttribute('aria-busy');
        updateButtons();
      }
    }

    async function storeCredential() {
      if (!password.value) return false;
      await services.secretSet(detail.credential, password.value);
      password.value = '';
      credentialState.textContent = 'Credential saved in the OS credential store.';
      return true;
    }

    function invalidateModels() { discovered = []; renderModels(); }
    url.addEventListener('input', invalidateModels);
    username.addEventListener('input', invalidateModels);

    async function loadModels() {
      show('Loading models…');
      discovered = await services.chatModels(snapshot());
      renderModels();
      show(discovered.length
        ? `Connected. ${discovered.length} models available. Choose a model, then save the connection.`
        : 'Connected, but no models were returned. Configure a provider or enter a custom model.');
    }
    async function saveKeyAndLoad() {
      await storeCredential();
      await loadModels();
    }
    connect.addEventListener('click', () => void act(saveKeyAndLoad));
    saveKey.addEventListener('click', () => void act(saveKeyAndLoad));
    password.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && password.value) { event.preventDefault(); saveKey.click(); }
    });
    save.addEventListener('click', () => void act(async () => {
      if (await storeCredential()) await loadModels();
      await saveSettings(snapshot());
      show(`${detail.name} selected. Changing the connection starts a new conversation.`);
    }));
    remove.addEventListener('click', () => void act(async () => {
      await services.secretClear(detail.credential);
      password.value = '';
      credentialState.textContent = 'No saved credential. Local servers may work without one.';
      show('Credential removed.');
    }));
    void services.secretPresent(detail.credential).then((present) => {
      if (busy || renderedRevision !== revision) return;
      credentialState.textContent = present
        ? 'Credential saved in the OS credential store. Leave the password field blank to keep it.'
        : 'No saved credential. Save a key to load models automatically, or reload a keyless local server.';
      if (present) void act(loadModels);
    });

    body.append(
      h('p', { class: 'hint', id: 'chat-help', text: isOpenCode
        ? 'Start OpenCode in PowerShell with the command below. Select a model offered by your server; free availability and quotas depend on its provider. This connection is for chat; agent tools are disabled.'
        : 'Start your 9router server, then use its API base URL including /v1. Select a model or combo configured in its dashboard; pricing and quotas depend on the provider.' }),
    );
    if (isOpenCode) body.append(h('code', { text: 'opencode serve --hostname 127.0.0.1 --port 4096' }));
    body.append(row('Server URL', url));
    if (isOpenCode) body.append(row('Username', username));
    body.append(row('Model', models), customRow, row(detail.label, password),
      h('div', { class: 'row' }, saveKey), credentialState,
      h('div', { class: 'row' }, connect, save, remove));
  }

  provider.addEventListener('change', () => { if (!busy) draw(); });
  draw();
  return section;
}

function row(label: string, field: HTMLInputElement | HTMLSelectElement): HTMLElement {
  return h('div', { class: 'row' }, h('label', { for: field.id, text: label }), field);
}

function selectedProvider(value: string): ChatProvider {
  switch (value) {
    case 'anthropic': return 'anthropic';
    case 'opencode': return 'opencode';
    case 'nineRouter': return 'nineRouter';
    default: throw new TypeError(`Unknown provider: ${value}`);
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

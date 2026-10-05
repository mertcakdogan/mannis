import { describe, expect, test } from 'bun:test';
import { DEFAULT_CHAT_SETTINGS, chatConnectionKey, providerDetails } from '../src/core/chat-config';

describe('chat connection selection', () => {
  test('keeps Anthropic as default for existing installations', () => {
    const settings = DEFAULT_CHAT_SETTINGS;
    expect(settings.chatProvider).toBe('anthropic');
  });
  test('separates each provider history', () => {
    const settings = { ...DEFAULT_CHAT_SETTINGS, model: 'legacy-model' };
    const first = chatConnectionKey(settings);
    const next = chatConnectionKey({ ...settings, chatProvider: 'opencode' });
    expect(next).not.toBe(first);
  });
  test('resets history when the selected OpenCode model changes', () => {
    const settings = { ...DEFAULT_CHAT_SETTINGS, model: 'legacy', chatProvider: 'opencode' as const };
    const first = chatConnectionKey(settings);
    const next = chatConnectionKey({ ...settings, opencodeModel: 'local/new-model' });
    expect(next).not.toBe(first);
  });
  test('ignores inactive provider configuration when using Anthropic', () => {
    const settings = { ...DEFAULT_CHAT_SETTINGS, model: 'legacy' };
    const first = chatConnectionKey(settings);
    const next = chatConnectionKey({ ...settings, nineRouterUrl: 'http://127.0.0.1:9000/v1' });
    expect(next).toBe(first);
  });
  test('uses distinct credential entries for local connections', () => {
    expect(providerDetails('opencode').credential).not.toBe(providerDetails('nineRouter').credential);
  });
});

describe('discovered model choices', () => {
  test('preserves a selected router alias missing from discovery', async () => {
    const { modelChoices } = await import('../src/core/chat-config');
    const models = [{ id: 'ocg/space-bunny-free', name: 'Space Bunny' }];
    const choices = modelChoices(models, 'oc/space-bunny-free');
    expect(choices.map(entry => entry.id)).toEqual(['oc/space-bunny-free', 'ocg/space-bunny-free']);
  });
  test('keeps discovered selections without duplicates', async () => {
    const { modelChoices } = await import('../src/core/chat-config');
    const models = [{ id: 'provider/model', name: 'Model' }];
    const choices = modelChoices(models, 'provider/model');
    expect(choices.map(entry => entry.id)).toEqual(['provider/model']);
  });
  test('leaves blank selection available for server default', async () => {
    const { modelChoices } = await import('../src/core/chat-config');
    const choices = modelChoices([], '');
    expect(choices).toEqual([]);
  });
});

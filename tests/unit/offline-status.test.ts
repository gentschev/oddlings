import { describe, expect, it, vi } from 'vitest';
import { createOfflineStatus, initialOfflineState, offlineDisplay, offlineReducer, offlineSnapshot, type OfflineState } from '../../src/platform/offlineStatus';
import { SpeechWarmup } from '../../src/platform/speechWarmup';
import { offlineSettingsText, storageNotice } from '../../src/parent/offlineInfo';
import { buildVersion } from '../../tools/buildVersion';

const full = (): OfflineState => ({ enabled: true, controlled: true, indexed: true, stored: 900, total: 900, finished: true });
describe('offline status', () => {
  it('is hidden when unsupported, reports partial progress, and waits for worker control and a completed pass', () => {
    let state = initialOfflineState();
    expect(offlineDisplay(state)).toBe('hidden'); expect(offlineSettingsText(state)).toBe('');
    expect(offlineSnapshot(state)).toEqual({ stored: 0, total: 0, ready: false });
    state = offlineReducer(state, { type: 'enabled' });
    state = offlineReducer(state, { type: 'progress', progress: { stored: 412, total: 900, finished: false, indexed: true } });
    expect(offlineDisplay(state)).toBe('getting'); expect(offlineSnapshot(state)).toEqual({ stored: 412, total: 900, ready: false });
    expect(offlineSettingsText(state)).toContain('412 / 900'); expect(offlineSettingsText(state)).toContain('Not ready yet');
    state = offlineReducer(state, { type: 'progress', progress: { stored: 900, total: 900, finished: true, indexed: true } });
    expect(offlineSnapshot(state).ready).toBe(false);
    state = offlineReducer(state, { type: 'controller', controlled: true });
    expect(offlineDisplay(state)).toBe('ready'); expect(offlineSettingsText(state)).toBe('Ready to play offline. 900 / 900 voices stored.');
    for (const patch of [{ enabled: false }, { controlled: false }, { indexed: false }, { finished: false }, { stored: 899 }, { stored: 0, total: 0 }])
      expect(offlineSnapshot({ ...full(), ...patch }).ready).toBe(false);
  });
  it('keeps a finished but incomplete pass visibly unready, and replaces counts on a new pass', () => {
    const original = full();
    const state = offlineReducer(original, { type: 'progress', progress: { stored: 899, total: 900, finished: true, indexed: true } });
    expect(offlineDisplay(state)).toBe('getting'); expect(offlineSnapshot(state).ready).toBe(false);
    expect(offlineReducer(state, { type: 'progress', progress: { stored: 0, total: 0, finished: false, indexed: false } }).stored).toBe(0);
    expect(original).toEqual(full());
  });
  it('notifies open views and removes scene subscriptions on shutdown', () => {
    const store = createOfflineStatus(), read = vi.fn(), unsubscribe = store.subscribe(read);
    expect(read).toHaveBeenCalledOnce(); store.dispatch({ type: 'enabled' }); expect(read).toHaveBeenCalledTimes(2);
    unsubscribe(); store.dispatch({ type: 'controller', controlled: true }); expect(read).toHaveBeenCalledTimes(2);
  });
});
describe('resuming voice downloads', () => {
  it('starts immediately, resumes after hiding, and never starts a parallel pass', async () => {
    let release!: () => void, complete = false;
    const run = vi.fn(() => new Promise<void>(resolve => { release = resolve; }));
    const warm = new SpeechWarmup(run, () => complete);
    const first = warm.start(); expect(warm.start()).toBe(first); await Promise.resolve(); expect(run).toHaveBeenCalledOnce();
    warm.visibilityChanged(false); warm.visibilityChanged(true); expect(run).toHaveBeenCalledOnce();
    release(); await first; await Promise.resolve(); expect(run).toHaveBeenCalledTimes(2);
    complete = true; release(); await warm.start();
    warm.visibilityChanged(false); warm.visibilityChanged(true); expect(run).toHaveBeenCalledTimes(2);
  });
  it('retries a finished partial or failed pass when visible again, and leaves complete passes alone', async () => {
    let complete = false;
    const run = vi.fn(async () => { if (run.mock.calls.length === 1) throw new Error('offline'); });
    const warm = new SpeechWarmup(run, () => complete);
    await warm.start(); warm.visibilityChanged(true); expect(run).toHaveBeenCalledOnce();
    warm.visibilityChanged(false); warm.visibilityChanged(true); await warm.start(); expect(run).toHaveBeenCalledTimes(2);
    complete = true; warm.visibilityChanged(false); warm.visibilityChanged(true); expect(run).toHaveBeenCalledTimes(2);
  });
});
describe('information for families', () => {
  it('shows the storage explanation and the limits of shared devices and offline files', () => {
    const section = storageNotice();
    for (const text of ['What this game stores', 'no accounts, no adverts and no tracking', 'asks for no name',
      'only in this browser on this device', 'Nothing about the child is sent anywhere', "browser's data", 'Export',
      "One device holds one player's progress", 'GitHub Pages', "device's internet address", 'first full download']) expect(section).toContain(text);
  });
  it('injects the UTC build date and short CI commit, with git and dev fallbacks', () => {
    const date = new Date('2026-11-13T16:00:00Z'), git = vi.fn(() => 'abcdef123');
    expect(buildVersion({ GITHUB_SHA: '1234567890abcdef' }, date, git)).toBe('2026-11-13 · 1234567'); expect(git).not.toHaveBeenCalled();
    expect(buildVersion({}, date, git)).toBe('2026-11-13 · abcdef1');
    expect(buildVersion({}, date, () => { throw Error('no git'); })).toBe('2026-11-13 · dev');
  });
});

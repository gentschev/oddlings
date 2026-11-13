import { afterEach, expect, it, vi } from 'vitest';
import { createSave } from '../../src/core';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });
it('shows no offline status in development or without service workers', async () => {
  const register = vi.fn(); vi.stubGlobal('navigator', { serviceWorker: { register } }); vi.stubEnv('PROD', false);
  const { startOfflineSupport } = await import('../../src/platform/offline');
  const { offlineStatus } = await import('../../src/platform/offlineStatus');
  startOfflineSupport(Promise.resolve(), createSave); expect(register).not.toHaveBeenCalled();
  vi.stubEnv('PROD', true); vi.stubGlobal('navigator', {});
  expect(() => startOfflineSupport(Promise.resolve(), createSave)).not.toThrow();
  expect(offlineStatus.get().enabled).toBe(false);
});
it('waits for worker readiness and launch, reports control changes, and orders using the current save', async () => {
  vi.stubEnv('PROD', true);
  let ready!: () => void, launch!: () => void;
  const workerEvents = new Map<string, () => void>(), pageEvents = new Map<string, () => void>();
  const worker = { controller: null as object | null, ready: new Promise<void>(resolve => { ready = resolve; }),
    register: vi.fn(async () => ({ update: async () => undefined })),
    addEventListener: (id: string, fn: () => void) => workerEvents.set(id, fn) };
  vi.stubGlobal('navigator', { serviceWorker: worker }); vi.stubGlobal('window', { caches: {} });
  vi.stubGlobal('document', { hidden: false, baseURI: 'https://example.test/repo/', addEventListener: (id: string, fn: () => void) => pageEvents.set(id, fn) });
  const cache = {}; vi.stubGlobal('caches', { open: async () => cache });
  const module = await import('../../src/platform/speechCache');
  const warm = vi.spyOn(module, 'warmSpeechCache').mockImplementation(async ports => {
    expect(ports.cache).toBe(cache); expect(ports.order?.(['story-den-0', 'story-welcome-0'])).toEqual(['story-den-0', 'story-welcome-0']);
    ports.report?.({ stored: 900, total: 900, indexed: true, finished: true });
  });
  const { startOfflineSupport } = await import('../../src/platform/offline');
  const { offlineStatus, offlineSnapshot } = await import('../../src/platform/offlineStatus');
  const save = createSave();
  startOfflineSupport(new Promise<void>(resolve => { launch = resolve; }), () => save);
  ready(); await Promise.resolve(); await Promise.resolve(); expect(warm).not.toHaveBeenCalled();
  save.map.area = 2; launch(); await vi.waitFor(() => expect(warm).toHaveBeenCalledOnce());
  expect(offlineSnapshot(offlineStatus.get()).ready).toBe(false);
  worker.controller = {}; workerEvents.get('controllerchange')!();
  expect(offlineSnapshot(offlineStatus.get()).ready).toBe(true);
  expect(pageEvents.has('visibilitychange')).toBe(true);
});

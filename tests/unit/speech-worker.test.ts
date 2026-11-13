import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpeechWorker, SpeechDownload, type SpeechWorkerPort } from '../../src/platform/speechDownload';
import { createOfflineStatus, offlineSnapshot } from '../../src/platform/offlineStatus';
import { SpeechWarmup } from '../../src/platform/speechWarmup';
import { warmSpeechInWorker } from '../../src/platform/speechWorkerHost';
import { workerProgressReporter, workerSpeechOrder, type SpeechWorkerMessage, type SpeechWorkerRequest } from '../../src/platform/speechWorkerProtocol';
import { SPEECH_CACHE, SPEECH_DOWNLOADS } from '../../src/platform/speechCache';

const request: SpeechWorkerRequest = { type: 'warm', base: 'https://example.test/school/oddlings/', ids: ['ui-play', 'fact-add-1-1'] };
class FakeWorker implements SpeechWorkerPort {
  onmessage: SpeechWorkerPort['onmessage'] = null;
  onerror: SpeechWorkerPort['onerror'] = null;
  onmessageerror: SpeechWorkerPort['onmessageerror'] = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  send(message: SpeechWorkerMessage) { this.onmessage?.({ data: message } as MessageEvent); }
}
function fixture() {
  const worker = new FakeWorker(), page = vi.fn(async (): Promise<void> => undefined), status = createOfflineStatus();
  status.dispatch({ type: 'enabled' }); status.dispatch({ type: 'controller', controlled: true });
  const factory = vi.fn(() => worker);
  const runner = new SpeechDownload({ worker: factory, page, report: progress => status.dispatch({ type: 'progress', progress }) });
  return { worker, page, status, factory, runner };
}
const progress = (stored: number, done = false): SpeechWorkerMessage => ({ type: 'progress', stored, total: 2, done, indexed: true });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('page and speech worker protocol', () => {
  it('sends a sub-path base and ordered ids, updates status, and terminates after the final update', async () => {
    const f = fixture(), pass = f.runner.run(request); await Promise.resolve();
    expect(f.worker.postMessage).toHaveBeenCalledWith(request);
    f.worker.send(progress(1)); expect(offlineSnapshot(f.status.get())).toEqual({ stored: 1, total: 2, ready: false });
    expect(f.status.get().finished).toBe(false); expect(f.worker.terminate).not.toHaveBeenCalled();
    const lateError = f.worker.onerror!;
    f.worker.send(progress(2, true)); await pass;
    expect(offlineSnapshot(f.status.get())).toEqual({ stored: 2, total: 2, ready: true });
    expect(f.status.get().finished).toBe(true); expect(f.worker.terminate).toHaveBeenCalledOnce();
    lateError({ preventDefault: vi.fn() } as unknown as ErrorEvent); expect(f.page).not.toHaveBeenCalled();
    expect(f.worker.onmessage).toBeNull(); expect(f.worker.onerror).toBeNull(); expect(f.worker.onmessageerror).toBeNull();
  });
  it.each(['unavailable', 'constructor throws'])('uses the page when the worker is %s', async kind => {
    const page = vi.fn(async () => undefined);
    const runner = new SpeechDownload({ worker: () => { if (kind === 'constructor throws') throw Error('blocked'); return undefined; },
      page, report: vi.fn() });
    await runner.run(request); expect(page).toHaveBeenCalledExactlyOnceWith(request);
  });
  it('terminates before falling back on a startup post failure', async () => {
    const f = fixture(); f.worker.postMessage.mockImplementation(() => { throw Error('could not start'); });
    f.page.mockImplementation(async () => { expect(f.worker.terminate).toHaveBeenCalledOnce(); });
    await f.runner.run(request); expect(f.page).toHaveBeenCalledExactlyOnceWith(request);
  });
  it.each(['error event', 'error message', 'messageerror', 'invalid message'])('falls back once on %s, without parallel work', async kind => {
    const f = fixture();
    let release!: () => void;
    f.page.mockImplementation(() => { expect(f.worker.terminate).toHaveBeenCalledOnce(); return new Promise<void>(resolve => { release = resolve; }); });
    const pass = f.runner.run(request); expect(f.runner.run(request)).toBe(pass); await Promise.resolve();
    const message = f.worker.onmessage!, error = f.worker.onerror!, messageError = f.worker.onmessageerror!;
    const event = { preventDefault: vi.fn() } as unknown as ErrorEvent;
    if (kind === 'error event') error(event);
    else if (kind === 'messageerror') messageError({} as MessageEvent);
    else message({ data: kind === 'error message' ? { type: 'error' } : { type: 'progress', stored: 9, total: 2, done: true } } as MessageEvent);
    // Late events and another start cannot create another page pass or revive the worker.
    error(event); message({ data: progress(2, true) } as MessageEvent);
    expect(f.runner.run(request)).toBe(pass); await Promise.resolve();
    expect(f.factory).toHaveBeenCalledOnce(); expect(f.page).toHaveBeenCalledOnce();
    expect(offlineSnapshot(f.status.get()).ready).toBe(false);
    release(); await pass; expect(f.worker.terminate).toHaveBeenCalledOnce();
  });
  it('does not duplicate a running worker, and resumes an incomplete pass after hiding', async () => {
    const status = createOfflineStatus(), workers: FakeWorker[] = [];
    const page = vi.fn(async () => undefined);
    const runner = new SpeechDownload({ worker: () => { const w = new FakeWorker(); workers.push(w); return w; }, page,
      report: value => status.dispatch({ type: 'progress', progress: value }) });
    const warmup = new SpeechWarmup(() => runner.run(request), () => {
      const state = status.get(); return state.finished && state.indexed && state.stored === state.total;
    });
    const first = warmup.start(); await Promise.resolve(); await Promise.resolve();
    expect(workers).toHaveLength(1);
    warmup.visibilityChanged(false); warmup.visibilityChanged(true);
    expect(workers).toHaveLength(1);
    workers[0]!.send(progress(1, true)); await first;
    await Promise.resolve(); await Promise.resolve(); expect(workers).toHaveLength(2);
    expect(workers[0]!.terminate).toHaveBeenCalledOnce(); expect(page).not.toHaveBeenCalled();
    const second = warmup.start(); workers[1]!.send(progress(2, true)); await second;
    warmup.visibilityChanged(false); warmup.visibilityChanged(true);
    await Promise.resolve(); expect(workers).toHaveLength(2);
    expect(workers[1]!.terminate).toHaveBeenCalledOnce();
  });
  it('creates a module worker and safely detects a missing Worker API', () => {
    const options: unknown[] = [];
    vi.stubGlobal('Worker', class extends FakeWorker {
      constructor(url: URL, config: WorkerOptions) { super(); options.push(url, config); }
    });
    expect(createSpeechWorker()).toBeInstanceOf(FakeWorker);
    expect((options[0] as URL).pathname).toMatch(/\/speechWorker\.ts$/); expect(options[1]).toEqual({ type: 'module' });
    vi.stubGlobal('Worker', undefined); expect(createSpeechWorker()).toBeUndefined();
  });
});

describe('worker download loop', () => {
  it('limits progress to four updates per second and always sends the final counts', () => {
    let now = 0; const send = vi.fn(), report = workerProgressReporter(() => now, send);
    const value = (stored: number, finished = false) => ({ stored, total: 900, finished, indexed: true });
    report(value(0));
    for (let i = 1; i <= 900; i++) { now = i; report(value(i)); }
    expect(send).toHaveBeenCalledTimes(4); // Initial, 250 ms, 500 ms and 750 ms.
    report(value(900, true)); expect(send).toHaveBeenCalledTimes(5);
    expect(send).toHaveBeenLastCalledWith({ type: 'progress', stored: 900, total: 900, indexed: true, done: true });
  });
  it('keeps page priority without dropping new index ids or repeating a clip', () => {
    expect(workerSpeechOrder(['ui', 'absent', 'ui'], ['fact', 'ui', 'new'])).toEqual(['ui', 'fact', 'new']);
  });
  it('flushes pending progress even when the last download stalls, and cancels the timer on completion', () => {
    vi.useFakeTimers();
    try {
      let now = 0; const send = vi.fn(), report = workerProgressReporter(() => now, send);
      report({ stored: 0, total: 0, indexed: false, finished: false });
      now = 10; report({ stored: 1, total: 2, indexed: true, finished: false });
      expect(send).toHaveBeenCalledOnce();
      now = 250; vi.advanceTimersByTime(250);
      expect(send).toHaveBeenLastCalledWith({ type: 'progress', stored: 1, total: 2, indexed: true, done: false });
      now = 260; report({ stored: 2, total: 2, indexed: true, finished: false });
      report({ stored: 2, total: 2, indexed: true, finished: true });
      expect(send).toHaveBeenCalledTimes(3);
      vi.runOnlyPendingTimers(); expect(send).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
  it('uses worker-side fetch and cache ports, six downloads and no timer pauses', async () => {
    const data = new Map<string, Response>(), sent: SpeechWorkerMessage[] = [], visited: string[] = [];
    const cache = { match: async (key: RequestInfo | URL) => data.get(String(key))?.clone(),
      put: async (key: RequestInfo | URL, value: Response) => { data.set(String(key), value.clone()); },
      delete: async (key: RequestInfo | URL) => data.delete(String(key)) };
    let active = 0, peak = 0;
    const index = Object.fromEntries(['fact-add-1-1', 'ui-play', ...Array.from({ length: 6 }, (_, i) => `rest-${i}`)].map(id => [id, { file: `${id}.m4a` }]));
    const open = vi.fn(async () => cache), timer = vi.spyOn(globalThis, 'setTimeout'), schedule = vi.fn(() => () => undefined);
    await warmSpeechInWorker(request, { open, schedule, now: () => 0, send: message => sent.push(message), fetch: async (url, options) => {
      expect(url.startsWith(request.base)).toBe(true); expect((options as RequestInit & { priority: string }).priority).toBe('low');
      if (url.endsWith('index.json')) return Response.json(index);
      visited.push(url.split('/').pop()!); active++; peak = Math.max(active, peak);
      await Promise.resolve(); active--; return new Response('sound');
    } });
    expect(open).toHaveBeenCalledExactlyOnceWith(SPEECH_CACHE);
    expect(peak).toBe(SPEECH_DOWNLOADS); expect(visited.slice(0, 2)).toEqual(['ui-play.m4a', 'fact-add-1-1.m4a']);
    expect(sent).toEqual([{ type: 'progress', stored: 0, total: 0, indexed: false, done: false },
      { type: 'progress', stored: 8, total: 8, indexed: true, done: true }]);
    expect(timer).not.toHaveBeenCalled(); expect(schedule).toHaveBeenCalledOnce(); expect(data.size).toBe(9);
  });
  it('reports worker setup failure so the page can fall back', async () => {
    const send = vi.fn();
    await warmSpeechInWorker(request, { open: async () => { throw Error('worker cache unavailable'); },
      fetch: vi.fn(), now: () => 0, send });
    expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'error' });
  });
});

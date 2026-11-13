import { expect, it, vi } from 'vitest';
import { SPEECH_DOWNLOADS, SPEECH_IDLE_MS, warmSpeechCache } from '../../src/platform/speechCache';
import type { SpeechProgress } from '../../src/platform/offlineStatus';

function fakeCache() {
  const data = new Map<string, Response>();
  return { data, match: vi.fn(async (key: RequestInfo | URL) => data.get(String(key))?.clone()),
    put: vi.fn(async (key: RequestInfo | URL, response: Response) => { data.set(String(key), response.clone()); }),
    delete: vi.fn(async (key: RequestInfo | URL) => data.delete(String(key))),
    keys: vi.fn(async () => [...data.keys()].map(url => ({ url }) as Request)) };
}
it('warms speech under a sub-path with bounded concurrency, ignoring missing files and external names', async () => {
  const cache = fakeCache(); let active = 0, peak = 0;
  const index = { ...Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`line-${i}`, { file: `line-${i}.m4a`, text: `Line ${i}` }])),
    unsafe: { file: 'https://external.test/file.m4a' }, missing: { file: 'missing.m4a' } };
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('index.json')) return Response.json(index);
    active++; peak = Math.max(peak, active); await Promise.resolve(); active--;
    return url.endsWith('missing.m4a') ? new Response('', { status: 404 }) : new Response('sound', { headers: { 'content-type': 'audio/mp4' } });
  });
  await warmSpeechCache({ base: 'https://example.test/repo/', cache, fetch: fetcher, pause: async () => undefined });
  expect(peak).toBeLessThanOrEqual(SPEECH_DOWNLOADS); expect(peak).toBeGreaterThan(1);
  expect(cache.data.has('https://example.test/repo/assets/speech/line-7.m4a')).toBe(true);
  expect(cache.data.has('https://example.test/repo/assets/speech/missing.m4a')).toBe(false);
  expect(fetcher.mock.calls.every(([url]) => url.startsWith('https://example.test/repo/'))).toBe(true);
  const count = fetcher.mock.calls.length;
  await warmSpeechCache({ base: 'https://example.test/repo/', cache, fetch: fetcher, pause: async () => undefined });
  expect(fetcher.mock.calls.length - count).toBe(2); // Index and still-missing recording only.
});
it('replaces regenerated recordings and quietly handles an absent index', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/'; let text = 'Old';
  const fetcher = vi.fn(async (url: string) => url.endsWith('index.json') ? Response.json({ hello: { file: 'hello.m4a', text } }) : new Response(text));
  const ports = { base, cache, fetch: fetcher, pause: async () => undefined };
  await warmSpeechCache(ports); text = 'New'; await warmSpeechCache(ports);
  expect(await cache.data.get(`${base}assets/speech/hello.m4a`)!.text()).toBe('New');
  // Replacing the entry with put keeps the old sound intact if the write fails.
  expect(cache.delete).not.toHaveBeenCalledWith(`${base}assets/speech/hello.m4a`);
  await expect(warmSpeechCache({ ...ports, fetch: async () => { throw Error('offline'); } })).resolves.toBeUndefined();
});

it('retries an HTML fallback instead of treating it as a cached recording', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/';
  cache.data.set(`${base}assets/speech/hello.m4a`, new Response('<html>Offline shell</html>', { headers: { 'content-type': 'text/html' } }));
  const fetcher = vi.fn(async (url: string) => url.endsWith('index.json') ? Response.json({ hello: { file: 'hello.m4a' } }) : new Response('real sound'));
  await warmSpeechCache({ base, cache, fetch: fetcher, pause: async () => undefined });
  expect(await cache.data.get(`${base}assets/speech/hello.m4a`)!.text()).toBe('real sound');
});

it('fetches a regenerated recording at a new address and drops the old one', async () => {
  // Found on the live update test: a clip kept its address when its content changed, and a
  // copy from the browser's own ten-minute cache was stored again as the old recording.
  const cache = fakeCache(), base = 'https://example.test/repo/'; let rev = 'aaaaaaaa';
  const seen: string[] = [];
  const fetcher = vi.fn(async (url: string) => { seen.push(url); return url.endsWith('index.json') ? Response.json({ hello: { file: 'hello.m4a', rev } }) : new Response(`sound ${url}`); });
  const ports = { base, cache, fetch: fetcher, pause: async () => undefined };
  await warmSpeechCache(ports);
  expect(cache.data.has(`${base}assets/speech/hello.m4a?v=aaaaaaaa`)).toBe(true);
  rev = 'bbbbbbbb'; await warmSpeechCache(ports);
  expect(cache.data.has(`${base}assets/speech/hello.m4a?v=bbbbbbbb`)).toBe(true);
  expect(cache.data.has(`${base}assets/speech/hello.m4a?v=aaaaaaaa`)).toBe(false);
  expect(seen.filter(u => u.includes('hello.m4a'))).toEqual([`${base}assets/speech/hello.m4a?v=aaaaaaaa`, `${base}assets/speech/hello.m4a?v=bbbbbbbb`]);
});

it('moves a device from an index without revisions to one with them', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/'; let index: Record<string, object> = { hello: { file: 'hello.m4a', text: 'Hi' } };
  const fetcher = vi.fn(async (url: string) => url.endsWith('index.json') ? Response.json(index) : new Response(`sound ${url}`));
  const ports = { base, cache, fetch: fetcher, pause: async () => undefined };
  await warmSpeechCache(ports);
  expect(cache.data.has(`${base}assets/speech/hello.m4a`)).toBe(true);
  index = { hello: { file: 'hello.m4a', text: 'Hi', ms: 500, rev: '0123abcd' } }; await warmSpeechCache(ports);
  expect(cache.data.has(`${base}assets/speech/hello.m4a`)).toBe(false);
  expect(await cache.data.get(`${base}assets/speech/hello.m4a?v=0123abcd`)!.text()).toContain('?v=0123abcd');
});

it('sweeps stored clips that no index entry points at, and nothing outside the speech folder', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/';
  cache.data.set(`${base}assets/speech/hello.m4a`, new Response('old unversioned'));
  cache.data.set(`${base}assets/speech/gone.m4a?v=11111111`, new Response('removed line'));
  cache.data.set(`${base}assets/art/keep.png`, new Response('not speech'));
  const fetcher = vi.fn(async (url: string) => url.endsWith('index.json') ? Response.json({ hello: { file: 'hello.m4a', rev: 'cccccccc' } }) : new Response('new'));
  await warmSpeechCache({ base, cache, fetch: fetcher, pause: async () => undefined });
  expect([...cache.data.keys()].sort()).toEqual([`${base}assets/art/keep.png`, `${base}assets/speech/hello.m4a?v=cccccccc`, `${base}assets/speech/index.json`]);
});

it('reports stored clips, excludes missing and HTML responses, finishes honestly, and resumes from cache', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/', reports: SpeechProgress[] = [];
  const index = { hello: { file: 'hello.m4a' }, missing: { file: 'missing.m4a' }, html: { file: 'html.m4a' } };
  let complete = false;
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    expect((options as RequestInit & { priority?: string })?.priority).toBe('low');
    if (url.endsWith('index.json')) return Response.json(index);
    if (complete || url.endsWith('hello.m4a')) return new Response('sound');
    if (url.endsWith('missing.m4a')) return new Response('', { status: 404 });
    return new Response('<html>', { headers: { 'content-type': 'text/html' } });
  });
  const ports = { base, cache, fetch: fetcher, pause: async () => undefined, report: (progress: SpeechProgress) => reports.push(progress) };
  await warmSpeechCache(ports);
  expect(reports.at(-1)).toEqual({ stored: 1, total: 3, indexed: true, finished: true });
  expect(reports.slice(0, -1).every(r => !r.finished)).toBe(true);
  complete = true; await warmSpeechCache(ports);
  expect(reports.at(-1)).toEqual({ stored: 3, total: 3, indexed: true, finished: true });
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('hello.m4a'))).toHaveLength(1);
  expect(SPEECH_DOWNLOADS).toBe(6); expect(SPEECH_IDLE_MS).toBe(10);
});

it('keeps an old recording when its replacement fails, without counting it as the current clip', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/', report = vi.fn();
  cache.data.set(`${base}assets/speech/index.json`, Response.json({ hello: { file: 'hello.m4a', rev: 'aaaaaaaa' } }));
  cache.data.set(`${base}assets/speech/hello.m4a?v=aaaaaaaa`, new Response('old sound'));
  const ports = { base, cache, report, pause: async () => undefined, fetch: async (url: string) => {
    if (url.endsWith('index.json')) return Response.json({ hello: { file: 'hello.m4a', rev: 'bbbbbbbb' } });
    throw Error('offline');
  } };
  await warmSpeechCache(ports);
  expect(cache.data.has(`${base}assets/speech/hello.m4a?v=aaaaaaaa`)).toBe(true);
  expect(report).toHaveBeenLastCalledWith({ stored: 0, total: 1, indexed: true, finished: true });
});

it('reports an unavailable index as unfinished readiness, but can use its previous offline index', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/', report = vi.fn();
  const ports = { base, cache, report, fetch: async () => { throw Error('offline'); }, pause: async () => undefined };
  await warmSpeechCache(ports);
  expect(report).toHaveBeenLastCalledWith({ stored: 0, total: 0, indexed: false, finished: true });
  cache.data.set(`${base}assets/speech/index.json`, Response.json({ hello: { file: 'hello.m4a', rev: 'aaaaaaaa' } }));
  cache.data.set(`${base}assets/speech/hello.m4a?v=aaaaaaaa`, new Response('sound'));
  await warmSpeechCache(ports);
  expect(report).toHaveBeenLastCalledWith({ stored: 1, total: 1, indexed: true, finished: true });
});

it('uses the priority order without dropping or duplicating catalogue clips', async () => {
  const cache = fakeCache(), visited: string[] = [];
  await warmSpeechCache({ base: 'https://example.test/', cache, pause: async () => undefined,
    order: () => ['ui', 'ui'], fetch: async url => {
      if (url.endsWith('index.json')) return Response.json({ fact: { file: 'fact.m4a' }, ui: { file: 'ui.m4a' } });
      visited.push(url); return new Response('sound');
    } });
  expect(visited.map(url => url.split('/').pop())).toEqual(['ui.m4a', 'fact.m4a']);
});

it('keeps an unversioned recording and retries its changed metadata after a failed replacement write', async () => {
  const cache = fakeCache(), base = 'https://example.test/repo/';
  const old = { hello: { file: 'hello.m4a', text: 'Old' } }, current = { hello: { file: 'hello.m4a', text: 'New' } };
  cache.data.set(`${base}assets/speech/index.json`, Response.json(old));
  cache.data.set(`${base}assets/speech/hello.m4a`, new Response('old sound'));
  const originalPut = cache.put;
  cache.put = vi.fn(async (key, value) => { if (String(key).endsWith('.m4a')) throw Error('quota'); await originalPut(key, value); });
  const report = vi.fn(), fetcher = vi.fn(async url => url.endsWith('index.json') ? Response.json(current) : new Response('new sound'));
  const ports = { base, cache, report, fetch: fetcher, pause: async () => undefined };
  await warmSpeechCache(ports);
  expect(await cache.data.get(`${base}assets/speech/hello.m4a`)!.clone().text()).toBe('old sound');
  expect(await cache.data.get(`${base}assets/speech/index.json`)!.clone().json()).toEqual(old);
  expect(report).toHaveBeenLastCalledWith({ stored: 0, total: 1, indexed: true, finished: true });
  cache.put = originalPut; await warmSpeechCache(ports);
  expect(await cache.data.get(`${base}assets/speech/hello.m4a`)!.text()).toBe('new sound');
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('.m4a'))).toHaveLength(2);
});

it('does not establish readiness when the index cannot be kept for offline use', async () => {
  const cache = fakeCache(), report = vi.fn();
  const put = cache.put;
  cache.put = vi.fn(async (key, value) => { if (String(key).endsWith('index.json')) throw Error('quota'); await put(key, value); });
  await warmSpeechCache({ base: 'https://example.test/', cache, report, pause: async () => undefined,
    fetch: async url => url.endsWith('index.json') ? Response.json({ hello: { file: 'hello.m4a' } }) : new Response('sound') });
  expect(report).toHaveBeenLastCalledWith({ stored: 1, total: 1, indexed: false, finished: true });
});

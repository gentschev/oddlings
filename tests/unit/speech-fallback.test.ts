import { expect, it, vi } from 'vitest';
import { SpeechPlayer, type SpeechAudio } from '../../src/audio/SpeechPlayer';
import { storedSpeech } from '../../src/platform/speechStorage';

function fixture() {
  const base = 'https://example.test/repo/';
  const data = new Map<string, Response>();
  const cache = { keys: async () => [...data.keys()].map(url => new Request(url)),
    match: async (request: RequestInfo | URL) => data.get(request instanceof Request ? request.url : String(request))?.clone() };
  const create = vi.fn((blob: Blob) => { expect(blob.size).toBeGreaterThan(0); return 'blob:old-recording'; }), revoke = vi.fn();
  return { data, base, create, revoke, fallback: (url: string) => storedSpeech(url, { base, open: async () => cache, create, revoke }) };
}
function audio(): SpeechAudio { return { play: vi.fn(async () => undefined), pause: vi.fn(), onerror: null }; }
it('plays an old revision from the speech cache after the current revision fails, then releases its object URL', async () => {
  const f = fixture(); f.data.set(`${f.base}assets/speech/hello.m4a?v=aaaaaaaa`, new Response('old audio'));
  const first = audio(), old = audio(), create = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(old);
  const player = new SpeechPlayer(async () => ({ hello: { file: 'hello.m4a', rev: 'bbbbbbbb' } }), create, f.fallback);
  await player.say('hello'); expect(create).toHaveBeenCalledWith('assets/speech/hello.m4a?v=bbbbbbbb');
  (first.onerror as () => void)();
  await vi.waitFor(() => expect(create).toHaveBeenCalledWith('blob:old-recording'));
  expect(old.play).toHaveBeenCalledOnce(); expect(first.pause).toHaveBeenCalled();
  old.onended?.call({} as GlobalEventHandlers, {} as Event); expect(f.revoke).toHaveBeenCalledOnce();
});
it('matches only the same local file path, ignores only v, and rejects HTML and failed responses', async () => {
  const f = fixture();
  for (const [url, response] of [
    ['https://elsewhere.test/repo/assets/speech/hello.m4a?v=11111111', new Response('wrong origin')],
    ['https://example.test/other/assets/speech/hello.m4a?v=11111111', new Response('wrong path')],
    [`${f.base}assets/speech/hello.m4a?v=11111111&other=x`, new Response('wrong query')],
    [`${f.base}assets/speech/hello.m4a?v=11111111`, new Response('<html>', { headers: { 'content-type': 'text/html' } })],
    [`${f.base}assets/speech/hello.m4a`, new Response('', { status: 404 })],
  ] as const) f.data.set(url, response);
  expect(await f.fallback('assets/speech/hello.m4a?v=bbbbbbbb')).toBeUndefined();
  f.data.set(`${f.base}assets/speech/hello.m4a`, new Response('legacy sound'));
  const stored = await f.fallback('assets/speech/hello.m4a?v=bbbbbbbb');
  expect(stored?.url).toBe('blob:old-recording'); expect(await f.create.mock.calls[0]![0]!.text()).toBe('legacy sound');
});
it('cancels a pending fallback on another tap, and never lets an old error pause the new line', async () => {
  let release!: (value: { url: string; release: () => void }) => void;
  const revoke = vi.fn(), fallback = vi.fn(() => new Promise<{ url: string; release: () => void }>(resolve => { release = resolve; }));
  const created: SpeechAudio[] = [], create = vi.fn(() => { const a = audio(); created.push(a); return a; });
  const player = new SpeechPlayer(async () => ({ first: { file: 'first.m4a' }, next: { file: 'next.m4a' } }), create, fallback);
  await player.say('first'); (created[0]!.onerror as () => void)();
  await player.say('next'); release({ url: 'blob:stale', release: revoke });
  await Promise.resolve(); await Promise.resolve();
  expect(create).toHaveBeenCalledTimes(2); expect(revoke).toHaveBeenCalledOnce();
  expect(created[1]!.pause).not.toHaveBeenCalled();
});
it('tries fallback once on play rejection, continues the sequence on failure, and tolerates blocked caches', async () => {
  const failed = audio(); vi.mocked(failed.play).mockRejectedValue(new Error('offline'));
  const working = audio(), create = vi.fn().mockReturnValueOnce(failed).mockReturnValueOnce(working);
  const fallback = vi.fn(async () => undefined);
  const player = new SpeechPlayer(async () => ({ first: { file: 'first.m4a' }, next: { file: 'next.m4a' } }), create, fallback);
  await player.saySequence(['first', 'next']); expect(working.play).toHaveBeenCalledOnce(); expect(fallback).toHaveBeenCalledOnce();
  await expect(storedSpeech('assets/speech/no.m4a', { base: 'https://example.test/', open: async () => { throw Error('denied'); },
    create: () => '', revoke: () => undefined })).resolves.toBeUndefined();
});

it('stops a cached recording and releases its URL when the child taps another line', async () => {
  const f = fixture(); f.data.set(`${f.base}assets/speech/hello.m4a`, new Response('old audio'));
  const first = audio(); vi.mocked(first.play).mockRejectedValue(Error('offline'));
  const cached = audio(), next = audio(), create = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(cached).mockReturnValueOnce(next);
  const player = new SpeechPlayer(async () => ({ hello: { file: 'hello.m4a' }, next: { file: 'next.m4a' } }), create, f.fallback);
  await player.say('hello'); await player.say('next');
  expect(cached.pause).toHaveBeenCalledOnce(); expect(f.revoke).toHaveBeenCalledOnce();
  (first.onerror as () => void)(); expect(next.pause).not.toHaveBeenCalled();
});

it('can read the warm-up index when its network and worker index copies are unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw Error('offline'); }));
  vi.stubGlobal('document', { baseURI: 'https://example.test/repo/' });
  const match = vi.fn(async () => Response.json({ hello: { file: 'hello.m4a', ms: 850 } }));
  vi.stubGlobal('caches', { open: async () => ({ match }) });
  try {
    const player = new SpeechPlayer(undefined, audio);
    await player.preload(); expect(player.duration('hello')).toBe(850);
    expect(match).toHaveBeenCalledWith('https://example.test/repo/assets/speech/index.json');
  } finally { vi.unstubAllGlobals(); }
});

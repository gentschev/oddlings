import { SPEECH_CACHE, storedSpeech, type StoredSpeech } from '../platform/speechStorage';

export interface SpeechEntry { file: string; ms?: number; rev?: string }
/** Request the current revision first. Playback may use an older stored clip offline. */
export function speechURL(entry: { file: string; rev?: string }): string {
  return `assets/speech/${entry.file}${typeof entry.rev === 'string' && /^[a-f0-9]{8}$/.test(entry.rev) ? `?v=${entry.rev}` : ''}`;
}
export type SpeechIndex = Record<string, SpeechEntry>;
export interface SpeechAudio { play(): Promise<void>; pause(): void; onerror: OnErrorEventHandler; onended?: GlobalEventHandlers['onended'] }
async function loadIndex(): Promise<SpeechIndex> {
  try {
    const response = await fetch('assets/speech/index.json');
    if (!response.ok) throw new Error('Missing speech index');
    const data: unknown = await response.json();
    return data && typeof data === 'object' && !Array.isArray(data) ? data as SpeechIndex : {};
  } catch {
    try {
      const cache = await caches.open(SPEECH_CACHE);
      const response = await cache.match(new URL('assets/speech/index.json', document.baseURI).href);
      const data: unknown = await response?.json();
      return data && typeof data === 'object' && !Array.isArray(data) ? data as SpeechIndex : {};
    } catch { return {}; }
  }
}
/** One local line at a time, with cached speech preferred to silence when offline. */
export class SpeechPlayer {
  private index?: Promise<SpeechIndex>;
  private entries: SpeechIndex = {};
  private active?: SpeechAudio;
  private release?: () => void;
  private request = 0;
  constructor(private readonly load = loadIndex, private readonly create: (url: string) => SpeechAudio = url => new Audio(url),
    private readonly fallback: (url: string) => Promise<StoredSpeech | undefined> = storedSpeech) {}
  preload(): Promise<SpeechIndex> {
    this.index ??= this.load().catch(() => ({})).then(index => { this.entries = index; return index; });
    return this.index;
  }
  duration(id: string): number {
    const ms = this.entries[id]?.ms;
    return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : 0;
  }
  stop(): void { this.request++; this.active?.pause(); this.active = undefined; this.release?.(); this.release = undefined; }
  say(id: string): Promise<void> { return this.saySequence([id]); }
  async saySequence(ids: readonly string[]): Promise<void> {
    this.stop();
    const ticket = this.request;
    const index = await this.preload();
    let cursor = 0;
    const next = async (): Promise<void> => {
      if (ticket !== this.request) return;
      while (cursor < ids.length) {
        const entry = index[ids[cursor++]!], file = entry?.file;
        if (!entry || typeof file !== 'string' || !/^[a-zA-Z0-9._-]+\.m4a$/.test(file)) continue;
        const original = speechURL(entry);
        const play = async (url: string, backup = false, release?: () => void): Promise<void> => {
          if (ticket !== this.request) { release?.(); return; }
          let settled = false, cleaned = false;
          const cleanup = () => {
            if (cleaned) return;
            cleaned = true; release?.(); if (this.release === cleanup) this.release = undefined;
          };
          const failed = async () => {
            if (settled) return;
            settled = true;
            if (ticket !== this.request) { cleanup(); return; }
            this.active?.pause(); cleanup();
            let stored: StoredSpeech | undefined;
            try { if (!backup) stored = await this.fallback(original); } catch { /* Try the next line. */ }
            if (ticket !== this.request) { stored?.release(); return; }
            if (stored) await play(stored.url, true, stored.release);
            else { this.active = undefined; await next(); }
          };
          try {
            const audio = this.create(url); this.active = audio; this.release = cleanup;
            audio.onended = () => {
              if (settled) return;
              settled = true; cleanup();
              if (ticket === this.request) { this.active = undefined; void next(); }
            };
            audio.onerror = () => { void failed(); };
            try { await audio.play(); } catch { await failed(); }
            if (ticket !== this.request) audio.pause();
          } catch { await failed(); }
        };
        await play(original); return;
      }
    };
    await next();
  }
}

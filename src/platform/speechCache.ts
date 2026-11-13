import { speechURL } from '../audio/SpeechPlayer';
import type { SpeechProgress } from './offlineStatus';
import { validRecording } from './speechStorage';

/** Shared with the service worker's CacheFirst route. */
export { SPEECH_CACHE } from './speechStorage';
/** Bounded, low-priority downloads keep the game responsive during first install. */
export const SPEECH_DOWNLOADS = 6;
export const SPEECH_IDLE_MS = 10;
interface Entry { file: string; text?: string; voice?: string; rev?: string }
export interface SpeechCachePorts {
  base: string;
  fetch(url: string, init?: RequestInit): Promise<Response>;
  cache: Pick<Cache, 'match' | 'put' | 'delete'> & Partial<Pick<Cache, 'keys'>>;
  pause(): Promise<void>;
  report?(progress: SpeechProgress): void;
  order?(ids: string[]): string[];
}
function entries(value: unknown): Record<string, Entry> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry && typeof entry === 'object'
    && typeof entry.file === 'string' && /^[a-zA-Z0-9._-]+\.m4a$/.test(entry.file)));
}
/** Runs after install. Keep old recordings until their replacements are safely stored. */
export async function warmSpeechCache(ports: SpeechCachePorts): Promise<void> {
  let stored = 0, total = 0, indexed = false;
  const report = (finished: boolean) => {
    try { ports.report?.({ stored, total, indexed, finished }); } catch { /* Status must not stop downloads. */ }
  };
  report(false);
  try {
    const indexURL = new URL('./assets/speech/index.json', ports.base).href;
    let previous: Record<string, Entry> = {};
    try { const old = await ports.cache.match(indexURL); if (old) previous = entries(await old.json()); } catch { /* No prior warm-up. */ }
    let index: Record<string, Entry>;
    try {
      const response = await ports.fetch(indexURL, { cache: 'no-cache', priority: 'low' } as RequestInit);
      if (!response.ok) throw new Error('Missing index');
      index = entries(await response.json());
      if (!Object.keys(index).length) throw new Error('Empty index');
    } catch {
      // The warm-up copy also supports a reload before the worker has cached the index.
      index = previous;
    }
    const ids = Object.keys(index);
    if (!ids.length) return;
    indexed = true; total = ids.length; report(false);
    const ordered = ports.order?.(ids) ?? ids;
    // An ordering callback must not drop or repeat clips.
    const list = [...new Set([...ordered, ...ids])].filter(id => Object.hasOwn(index, id));
    const address = (entry: Entry) => new URL(`./${speechURL(entry)}`, ports.base).href;
    const wanted = new Set(ids.map(id => address(index[id]!)));
    const available = new Set<string>();
    let next = 0;
    const download = async () => {
      while (next < list.length) {
        const id = list[next++]!, entry = index[id]!, url = address(entry);
        try {
          // An older, unversioned index can change a recording at the same address.
          const changed = !entry.rev && previous[id] && JSON.stringify(previous[id]) !== JSON.stringify(entry);
          let cached = await ports.cache.match(url);
          if (cached && !validRecording(cached)) { await ports.cache.delete(url); cached = undefined; }
          let ready = !!cached && !changed;
          if (!ready) {
            const result = await ports.fetch(url, { priority: 'low' } as RequestInit);
            if (validRecording(result)) { await ports.cache.put(url, result); ready = true; }
          }
          if (ready) { stored++; available.add(url); report(false); }
        } catch { /* An absent file, quota failure or lost connection leaves the clip retryable. */ }
        await ports.pause();
      }
    };
    await Promise.all(Array.from({ length: SPEECH_DOWNLOADS }, download));
    // Remove obsolete addresses only after the replacement is available. A stale clip
    // still matters offline if this pass could not get its current revision.
    const replacements = new Map(ids.map(id => [index[id]!.file, address(index[id]!)]));
    try {
      const folder = new URL('./assets/speech/', ports.base).href;
      const stale = [...Object.values(previous).map(entry => ({ url: address(entry) })), ...(await ports.cache.keys?.() ?? [])];
      for (const request of stale) {
        if (!request.url.startsWith(folder) || request.url === indexURL || wanted.has(request.url)) continue;
        const file = new URL(request.url).pathname.split('/').pop()!, replacement = replacements.get(file);
        if (!replacement || available.has(replacement)) await ports.cache.delete(request.url);
      }
    } catch { /* Best effort. */ }
    // Preserve old metadata for a failed unversioned replacement so the next pass retries.
    const savedIndex = Object.fromEntries(ids.map(id => [id, !index[id]!.rev && !available.has(address(index[id]!)) && previous[id] ? previous[id] : index[id]]));
    try { await ports.cache.put(indexURL, new Response(JSON.stringify(savedIndex), { headers: { 'Content-Type': 'application/json' } })); }
    catch { indexed = false; }
  } catch { /* Storage, fetch and the speech index are all optional. */ }
  finally { report(true); }
}

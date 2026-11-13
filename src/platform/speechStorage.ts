/** Shared by the worker, warm-up and the playback fallback. */
export const SPEECH_CACHE = 'oddlings-speech-v1';
export function validRecording(response: Response | undefined): response is Response {
  return !!response && response.status === 200 && !response.headers.get('content-type')?.includes('text/html');
}
export interface StoredSpeech { url: string; release(): void }
interface StoragePorts {
  base: string;
  open(): Promise<Pick<Cache, 'keys' | 'match'>>;
  create(blob: Blob): string;
  revoke(url: string): void;
}
/** Same origin and full path, ignoring only the recording's revision query. */
export async function storedSpeech(url: string, supplied?: StoragePorts): Promise<StoredSpeech | undefined> {
  try {
    const ports = supplied ?? { base: document.baseURI, open: () => caches.open(SPEECH_CACHE),
      create: (blob: Blob) => URL.createObjectURL(blob), revoke: (address: string) => URL.revokeObjectURL(address) };
    const target = new URL(url, ports.base), cache = await ports.open();
    for (const request of [...await cache.keys()].reverse()) {
      const candidate = new URL(request.url);
      if (candidate.origin !== target.origin || candidate.pathname !== target.pathname) continue;
      const a = new URL(candidate), b = new URL(target); a.searchParams.delete('v'); b.searchParams.delete('v');
      if (a.href !== b.href) continue;
      const response = await cache.match(request);
      if (!validRecording(response)) continue;
      const address = ports.create(await response.blob());
      return { url: address, release: () => ports.revoke(address) };
    }
  } catch { /* Cache access and object URLs may be unavailable. */ }
}

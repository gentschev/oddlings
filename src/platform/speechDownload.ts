import type { SpeechProgress } from './offlineStatus';
import { isSpeechWorkerMessage, type SpeechWorkerRequest } from './speechWorkerProtocol';

export interface SpeechWorkerPort {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(request: SpeechWorkerRequest): void;
  terminate(): void;
}
interface DownloadPorts {
  worker(): SpeechWorkerPort | undefined;
  page(request: SpeechWorkerRequest): Promise<void>;
  report(progress: SpeechProgress): void;
}
export function createSpeechWorker(): SpeechWorkerPort | undefined {
  if (typeof Worker === 'undefined') return;
  return new Worker(new URL('./speechWorker.ts', import.meta.url), { type: 'module' });
}
/** One pass owns one worker. Terminate it before any fallback can start. */
export class SpeechDownload {
  private running?: Promise<void>;
  constructor(private readonly ports: DownloadPorts) {}
  run(request: SpeechWorkerRequest): Promise<void> {
    if (this.running) return this.running;
    this.running = Promise.resolve().then(() => this.pass(request)).finally(() => { this.running = undefined; });
    return this.running;
  }
  private pass(request: SpeechWorkerRequest): Promise<void> {
    let worker: SpeechWorkerPort | undefined;
    try { worker = this.ports.worker(); } catch { /* Blocked or unsupported workers use the page. */ }
    if (!worker) return this.ports.page(request);
    const active = worker;
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const stop = () => {
        active.onmessage = null; active.onerror = null; active.onmessageerror = null;
        try { active.terminate(); } catch { /* The worker may already have stopped. */ }
      };
      const fallback = () => {
        if (settled) return;
        settled = true; stop();
        void Promise.resolve().then(() => this.ports.page(request)).then(resolve, reject);
      };
      active.onmessage = event => {
        if (settled) return;
        if (!isSpeechWorkerMessage(event.data) || event.data.type === 'error') { fallback(); return; }
        const message = event.data;
        if (message.done) { settled = true; stop(); }
        try { this.ports.report({ stored: message.stored, total: message.total, finished: message.done, indexed: message.indexed }); }
        catch { /* A view must not block downloads or completion. */ }
        if (message.done) resolve();
      };
      active.onerror = event => { event.preventDefault(); fallback(); };
      active.onmessageerror = fallback;
      try { active.postMessage(request); } catch { fallback(); }
    });
  }
}

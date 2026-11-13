import { warmSpeechInWorker } from './speechWorkerHost';
import type { SpeechWorkerMessage, SpeechWorkerRequest } from './speechWorkerProtocol';

// A small dedicated-worker interface avoids mixing DOM and worker global type libraries.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SpeechWorkerRequest>) => void) | null;
  postMessage(message: SpeechWorkerMessage): void;
};
let started = false;
scope.onmessage = event => {
  if (started) return;
  started = true;
  void warmSpeechInWorker(event.data, { open: name => caches.open(name), fetch: (url, options) => fetch(url, options),
    now: () => performance.now(), send: message => scope.postMessage(message) });
};

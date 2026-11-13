import { SPEECH_CACHE, warmSpeechCache, type SpeechCachePorts } from './speechCache';
import { workerProgressReporter, workerSpeechOrder, type ProgressSchedule, type SpeechWorkerMessage, type SpeechWorkerRequest } from './speechWorkerProtocol';

interface WorkerPorts {
  open(name: string): Promise<SpeechCachePorts['cache']>;
  fetch(url: string, options?: RequestInit): Promise<Response>;
  now(): number;
  send(message: SpeechWorkerMessage): void;
  schedule?: ProgressSchedule;
}
/** Worker-side ports share the existing six-download loop, without timer pauses. */
export async function warmSpeechInWorker(request: SpeechWorkerRequest, ports: WorkerPorts): Promise<void> {
  try {
    await warmSpeechCache({ base: request.base, cache: await ports.open(SPEECH_CACHE), fetch: ports.fetch,
      pause: async () => undefined, order: ids => workerSpeechOrder(request.ids, ids),
      report: workerProgressReporter(ports.now, ports.send, ports.schedule) });
  } catch { ports.send({ type: 'error' }); }
}

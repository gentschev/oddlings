import { SPEECH_CACHE, SPEECH_IDLE_MS, warmSpeechCache } from './speechCache';
import { offlineStatus, type SpeechProgress } from './offlineStatus';
import { SpeechWarmup } from './speechWarmup';
import { orderSpeechIds } from './speechOrder';
import type { Save } from '../core';
import { speechLines } from '../game/speechLines';
import { createSpeechWorker, SpeechDownload } from './speechDownload';
import { workerSpeechOrder } from './speechWorkerProtocol';

export function startOfflineSupport(launched: Promise<void>, save: () => Save): void {
  try {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    offlineStatus.dispatch({ type: 'enabled' });
    const controlled = () => offlineStatus.dispatch({ type: 'controller', controlled: !!navigator.serviceWorker.controller });
    controlled(); navigator.serviceWorker.addEventListener('controllerchange', controlled);
    // Native registration avoids an extra client dependency. The generated worker
    // claims updates immediately; the current game stays open until the next launch.
    void navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(async registration => {
      void registration.update().catch(() => undefined);
      await Promise.all([launched, navigator.serviceWorker.ready]);
      if (!('caches' in window)) return;
      const report = (progress: SpeechProgress) => offlineStatus.dispatch({ type: 'progress', progress });
      const download = new SpeechDownload({ worker: createSpeechWorker,
        report,
        page: async request => warmSpeechCache({ base: request.base, fetch: (url, options) => fetch(url, options),
          cache: await caches.open(SPEECH_CACHE), pause: () => new Promise(resolve => setTimeout(resolve, SPEECH_IDLE_MS)),
          order: ids => workerSpeechOrder(request.ids, ids), report }) });
      const warmup = new SpeechWarmup(() => download.run({ type: 'warm', base: document.baseURI,
        ids: orderSpeechIds(speechLines().map(line => line.id), save()) }),
      () => { const state = offlineStatus.get(); return state.indexed && state.finished && state.stored === state.total; });
      document.addEventListener('visibilitychange', () => warmup.visibilityChanged(!document.hidden));
      warmup.visibilityChanged(!document.hidden);
      await warmup.start();
    }).catch(() => undefined);
  } catch { /* An unsupported or blocked worker leaves the ordinary app available. */ }
}

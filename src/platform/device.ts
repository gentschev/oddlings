import { STORAGE_NAMES } from './channel';

interface WakeHandle { released: boolean; release(): Promise<void> }
export interface PlayFeatures {
  visible(): boolean;
  wake?(): Promise<WakeHandle>;
  fullscreen?(): Promise<unknown>;
  persist?(): Promise<unknown>;
}
function attempt(action: (() => unknown) | undefined): void {
  try { void Promise.resolve(action?.()).catch(() => undefined); } catch { /* Optional platform feature. */ }
}
/** Call fullscreen and audio synchronously inside the tap, before any awaits. */
export class DeviceSupport {
  private started = false;
  private pending = false;
  private handle?: WakeHandle;
  constructor(private readonly features: PlayFeatures) {}
  play(resume: () => unknown): void {
    this.started = true;
    attempt(resume); attempt(this.features.fullscreen); attempt(this.features.persist);
    this.visibilityChanged();
  }
  visibilityChanged(): void {
    try {
      if (!this.features.visible()) {
        if (this.handle) attempt(() => this.handle!.release());
        this.handle = undefined; return;
      }
      if (!this.started || this.pending || this.handle && !this.handle.released || !this.features.wake) return;
      this.pending = true;
      void this.features.wake().then(handle => {
        if (this.features.visible()) this.handle = handle;
        else attempt(() => handle.release());
      }).catch(() => undefined).finally(() => { this.pending = false; });
    } catch { this.pending = false; }
  }
}
let support: DeviceSupport | undefined;
export function requestPlayFeatures(resume: () => unknown): void {
  try {
    support ??= new DeviceSupport({
      visible: () => document.visibilityState === 'visible',
      fullscreen: () => document.fullscreenElement ? Promise.resolve() : document.documentElement.requestFullscreen?.() ?? Promise.resolve(),
      persist: () => navigator.storage?.persist?.() ?? Promise.resolve(),
      wake: 'wakeLock' in navigator ? () => navigator.wakeLock.request('screen') : undefined,
    });
    support.play(resume);
  } catch { attempt(resume); }
}
export function initDeviceSupport(isTitle: () => boolean): void {
  try { document.addEventListener('visibilitychange', () => support?.visibilityChanged()); } catch { /* Unsupported document. */ }
  try { document.addEventListener('contextmenu', event => event.preventDefault()); } catch { /* Optional gesture guard. */ }
  try {
    const guard = STORAGE_NAMES.historyGuard;
    if (!history.state?.[guard]) history.pushState({ [guard]: true }, '', location.href);
    window.addEventListener('popstate', event => {
      try {
        if (isTitle()) { if (!event?.state?.[guard]) history.back(); }
        else history.pushState({ [guard]: true }, '', location.href);
      } catch { /* History can be unavailable in a restricted web view. */ }
    });
  } catch { /* History is optional. */ }
}

export interface SpeechProgress { stored: number; total: number; finished: boolean; indexed: boolean }
export interface OfflineState extends SpeechProgress { enabled: boolean; controlled: boolean }
export type OfflineEvent = { type: 'enabled' } | { type: 'controller'; controlled: boolean }
  | { type: 'progress'; progress: SpeechProgress };
export const initialOfflineState = (): OfflineState => ({ enabled: false, controlled: false,
  stored: 0, total: 0, finished: false, indexed: false });
/** Only a completed pass over a known index can establish voice readiness. */
export function offlineReducer(state: OfflineState, event: OfflineEvent): OfflineState {
  if (event.type === 'enabled') return { ...state, enabled: true };
  if (event.type === 'controller') return { ...state, controlled: event.controlled };
  const { total, stored } = event.progress;
  const count = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  return { ...state, ...event.progress, total: count,
    stored: Number.isFinite(stored) ? Math.max(0, Math.min(count, Math.floor(stored))) : 0 };
}
export function offlineSnapshot(state: OfflineState) {
  return { stored: state.stored, total: state.total,
    ready: state.enabled && state.controlled && state.indexed && state.finished && state.total > 0 && state.stored === state.total };
}
export function offlineDisplay(state: OfflineState): 'hidden' | 'getting' | 'ready' {
  return !state.enabled ? 'hidden' : offlineSnapshot(state).ready ? 'ready' : 'getting';
}
/** One page-local source for the canvas, parent page and test hook. */
export function createOfflineStatus() {
  let state = initialOfflineState();
  const listeners = new Set<(state: OfflineState) => void>();
  return {
    get: () => state,
    dispatch(event: OfflineEvent) {
      state = offlineReducer(state, event);
      for (const listener of listeners) listener(state);
    },
    subscribe(listener: (state: OfflineState) => void) {
      listeners.add(listener); listener(state);
      return () => { listeners.delete(listener); };
    },
  };
}
export const offlineStatus = createOfflineStatus();

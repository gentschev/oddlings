import type { SpeechProgress } from './offlineStatus';

export interface SpeechWorkerRequest { type: 'warm'; base: string; ids: string[] }
export interface SpeechWorkerProgress { type: 'progress'; stored: number; total: number; done: boolean; indexed: boolean }
export type SpeechWorkerMessage = SpeechWorkerProgress | { type: 'error' };
/** Four updates per second keep download continuations off the page's busy thread. */
export const SPEECH_PROGRESS_MS = 250;

export function isSpeechWorkerMessage(value: unknown): value is SpeechWorkerMessage {
  if (!value || typeof value !== 'object') return false;
  if ('type' in value && value.type === 'error') return true;
  const message = value as Partial<SpeechWorkerProgress>;
  return message.type === 'progress' && typeof message.stored === 'number' && Number.isInteger(message.stored)
    && typeof message.total === 'number' && Number.isInteger(message.total)
    && message.stored >= 0 && message.total >= message.stored
    && typeof message.done === 'boolean' && typeof message.indexed === 'boolean';
}
export type ProgressSchedule = (run: () => void, ms: number) => () => void;
const scheduleProgress: ProgressSchedule = (run, ms) => {
  const timer = setTimeout(run, ms); return () => clearTimeout(timer);
};
export function workerProgressReporter(now: () => number, send: (message: SpeechWorkerProgress) => void,
  schedule: ProgressSchedule = scheduleProgress) {
  let last = -Infinity, done = false, pending: SpeechProgress | undefined, cancel: (() => void) | undefined;
  const emit = (progress: SpeechProgress) => {
    last = now();
    send({ type: 'progress', stored: progress.stored, total: progress.total, done: progress.finished, indexed: progress.indexed });
  };
  const flush = () => {
    cancel = undefined;
    if (done || !pending) return;
    const progress = pending; pending = undefined; emit(progress);
  };
  return (progress: SpeechProgress) => {
    if (done) return;
    pending = progress;
    if (progress.finished) {
      done = true; cancel?.(); cancel = undefined; pending = undefined; emit(progress); return;
    }
    const wait = SPEECH_PROGRESS_MS - (now() - last);
    if (wait <= 0) { cancel?.(); flush(); }
    else if (!cancel) cancel = schedule(flush, wait);
  };
}
/** Preserve the page's priority groups and append any newer ids found in the index. */
export function workerSpeechOrder(ordered: readonly string[], available: readonly string[]): string[] {
  const known = new Set(available);
  return [...new Set([...ordered.filter(id => known.has(id)), ...available])];
}

import { SPEECH_TIMING } from './constants';

/** All automatic speech handoffs use game timers, never audio end events or wall time. */
export function speechWait(minimum: number, ms: number): number {
  const duration = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return Math.min(SPEECH_TIMING.maxWait, Math.max(minimum, duration + SPEECH_TIMING.gap));
}
export function introWait(ms: number): number {
  return ms > 0 ? speechWait(0, ms) : SPEECH_TIMING.quietIntro;
}

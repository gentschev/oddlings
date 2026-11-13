import { CLOCK_STEP_MS } from './constants';

export interface SteppableGame {
  headlessStep(time: number, delta: number): void;
  step(time: number, delta: number): void;
}
/** Phaser 4's headlessStep runs the same logic and lifecycle without submitting GL work. */
export function advanceWithoutIntermediateRenders(game: SteppableGame, time: number, ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) throw new Error('Invalid clock advance');
  let remaining = ms;
  while (remaining > 0) {
    const delta = Math.min(CLOCK_STEP_MS, remaining);
    time += delta;
    remaining -= delta;
    if (remaining > 0) game.headlessStep(time, delta);
    else game.step(time, delta);
  }
  return time;
}

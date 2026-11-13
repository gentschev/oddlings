/** The engine's meter counts work left; the child's slots count dots earned. */
export function filledSlotCount(initialMeter: number, meter: number): number {
  return Math.max(0, Math.min(initialMeter, initialMeter - meter));
}
export function slotStates(initialMeter: number, meter: number): boolean[] {
  const filled = filledSlotCount(initialMeter, meter);
  return Array.from({ length: initialMeter }, (_, i) => i < filled);
}
import { MUDDLE_TIMING } from '../game/constants';

export function deliveryDuration(count: number): number {
  return count ? MUDDLE_TIMING.flight + (count - 1) * MUDDLE_TIMING.stagger : 0;
}

import { MOTION, PATTERN } from '../game/constants';

/** Native stroke width that stays readable at the smallest breathing scale. */
export function muddleStroke(scale: number, width: number): number {
  const screen = width <= PATTERN.mapMaxWidth ? PATTERN.outlineMap : PATTERN.outlineScreen;
  return screen / (scale * (1 - MOTION.breath));
}

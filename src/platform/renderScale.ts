import { CANVAS, RENDER } from '../game/constants';

/**
 * How many canvas pixels to draw per logical pixel. The game is laid out on a 1280 x 800
 * canvas; a tablet screen has more physical pixels than that, and a canvas drawn at 1280
 * wide and stretched by the browser looks soft and blocky, small sprites most of all.
 * The answer is the largest the canvas can be on this screen in physical pixels, divided
 * by the logical size, kept between 1 and `RENDER.maxScale`.
 */
export function renderScale(screenWidth: number, screenHeight: number, pixelRatio: number): number {
  const long = Math.max(screenWidth, screenHeight), short = Math.min(screenWidth, screenHeight);
  const fit = Math.min(long / CANVAS.width, short / CANVAS.height) * pixelRatio;
  if (!Number.isFinite(fit)) return 1;
  const stepped = Math.round(fit / RENDER.step) * RENDER.step;
  return Math.min(RENDER.maxScale, Math.max(1, stepped));
}

/** Fixed for the session: the canvas is created once. */
export const RENDER_SCALE = typeof screen === 'undefined' ? 1
  : renderScale(screen.width, screen.height, globalThis.devicePixelRatio ?? 1);

import { describe, expect, it } from 'vitest';
import manifest from '../../public/assets/art/manifest.json';
import { CANVAS, RENDER } from '../../src/game/constants';
import { renderScale } from '../../src/platform/renderScale';
import { powerOfTwoAtLeast } from '../../src/ui/mipTexture';

describe('canvas pixels per logical pixel', () => {
  it('is one on a screen with no more pixels than the logical canvas', () => {
    expect(renderScale(1280, 800, 1)).toBe(1);
    expect(renderScale(1024, 768, 1)).toBe(1);
  });
  it('matches the physical pixels the canvas can cover, in either orientation', () => {
    expect(renderScale(1280, 800, 1.5)).toBe(1.5);   // 1920 x 1200 tablet
    expect(renderScale(800, 1280, 1.5)).toBe(1.5);   // the same tablet reported upright
    expect(renderScale(960, 600, 2)).toBe(1.5);      // the same panel at a denser setting
    expect(renderScale(1024, 768, 2)).toBe(1.5);     // 2048 x 1536: width allows 1.6, rounded to the step
  });
  it('is limited by the short side on a wide phone', () => {
    expect(renderScale(800, 360, 3)).toBe(1.25);     // 1080 px tall: 1.35, rounded to the step
  });
  it('never exceeds the limit and never goes below one', () => {
    expect(renderScale(1280, 800, 3)).toBe(RENDER.maxScale);
    expect(renderScale(2560, 1600, 2)).toBe(RENDER.maxScale);
    expect(renderScale(320, 200, 1)).toBe(1);
    expect(renderScale(Number.NaN, 800, 1)).toBe(1);
  });
  it('keeps the canvas a whole number of pixels at every step', () => {
    for (let scale = 1; scale <= RENDER.maxScale; scale += RENDER.step) {
      expect(Number.isInteger(CANVAS.width * scale)).toBe(true);
      expect(Number.isInteger(CANVAS.height * scale)).toBe(true);
    }
  });
});

describe('padded pal textures', () => {
  it('rounds a side up to a power of two', () => {
    expect([1, 2, 3, 206, 512, 513, 640, 1024].map(powerOfTwoAtLeast)).toEqual([1, 2, 4, 256, 512, 1024, 1024, 1024]);
  });
  it('keeps every pal and prop texture within 1024 x 1024', () => {
    for (const meta of Object.values(manifest.characters)) {
      expect(powerOfTwoAtLeast(meta.width)).toBeLessThanOrEqual(1024);
      expect(powerOfTwoAtLeast(meta.height)).toBeLessThanOrEqual(1024);
    }
  });
});

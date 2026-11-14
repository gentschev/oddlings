import { expect, test } from '@playwright/test';
import { click, launch, ready, state } from './helpers';

test.use({ deviceScaleFactor: 2 });

test('a dense screen gets a canvas at its own pixel count, and taps still land', async ({ page }) => {
  await launch(page, '/?skipIntro=1&fresh=1');
  const canvas = await page.evaluate(() => {
    const c = document.querySelector('canvas')!;
    return { width: c.width, height: c.height, shownWidth: c.clientWidth, shownHeight: c.clientHeight };
  });
  expect(canvas).toEqual({ width: 2560, height: 1600, shownWidth: 1280, shownHeight: 800 });
  expect(await state(page)).toMatchObject({ scene: 'map', renderScale: 2, canvas: { width: 1280, height: 800 } });
  await page.screenshot({ path: 'test-results/sharp-map.png' });
  // Controls are reported in logical pixels; the camera maps them to the larger canvas.
  await click(page, 'pp-welcome'); await ready(page, 'story');
  await page.screenshot({ path: 'test-results/sharp-story.png' });
});

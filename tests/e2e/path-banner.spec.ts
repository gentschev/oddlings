import { expect, test } from '@playwright/test';
import { click, launch, ready, reviewFixture, state, step, story } from './helpers';

test('a story explains the skipped skill with a nonmodal banner, and the next stop stays tappable', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome', 'ring', 'gate'];
  save.map.area = 2; save.map.position = 'tf-falls'; save.settings.sound = false;
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?skipIntro=1'); await click(page, 'tf-falls'); await story(page);
  expect(await state(page)).toMatchObject({ markerIndex: 2, passedOver: 1,
    banner: 'You already know this one!', modal: false, busy: false, speechId: 'ui-knowThis' });
  expect((await state(page)).onScreen).toContain('You already know this one!');
  await page.screenshot({ path: 'test-results/banner-twin-falls.png' });
  await click(page, 'tf-den'); await ready(page, 'story');
});

test('several passed skills use the plural banner and it clears on the game clock', async ({ page }) => {
  const save = reviewFixture(); save.settings.sound = false;
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?skipIntro=1'); await click(page, 'pp-welcome'); await story(page);
  expect(await state(page)).toMatchObject({ markerIndex: 5, passedOver: 4, banner: 'You already know these!', modal: false });
  await page.screenshot({ path: 'test-results/banner-pebble-path.png' });
  await step(page, 1000); expect((await state(page)).banner).toBe('You already know these!');
  await step(page, 1200); expect((await state(page)).banner).toBe('');
});

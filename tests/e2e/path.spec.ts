import { expect, test } from '@playwright/test';
import { createSave } from '../../src/core';
import { STRINGS } from '../../src/game/strings';
import { click, launch, ready, reviewFixture, state, story } from './helpers';

test('the closed gate points to the skill path and locked stops do nothing', async ({ page }) => {
  await launch(page, '/?fresh=1&skipIntro=1'); const map = await ready(page, 'map');
  expect(map.stops.find(s => s.id === 'pp-see-frame')).toMatchObject({ state: 'locked', set: 'see-frame', pal: 'tenny' });
  const locked = map.controls.find(c => c.id === 'pp-see-frame')!;
  await page.mouse.click(locked.x, locked.y); expect((await state(page)).scene).toBe('map');
  await click(page, 'pp-gate'); expect((await state(page)).onScreen).toContain(STRINGS.gateClosed);
});

test('the ring keeps its four-line story and the gate remains closed until that beat is seen', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome']; save.settings.sound = false;
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?skipIntro=1');
  expect((await state(page)).stops.find(s => s.type === 'gate')!.open).toBe(false);
  await click(page, 'pp-ring'); await ready(page, 'story');
  expect((await state(page)).onScreen[0]).toBe('Stop! Look at the ground.');
  await click(page, 'next'); expect(await state(page)).toMatchObject({ line: 1, ringHighlighted: true });
  expect((await state(page)).onScreen[0]).toBe('A ring mark. Right here.');
  await story(page); const map = await ready(page, 'map');
  expect(map.stops.find(s => s.type === 'gate')!.open).toBe(true); expect(map.markerIndex).toBe(11);
});

test('the house is available without clearing a stop', async ({ page }) => {
  const save = createSave(); save.team = { partner: 'tenny', friends: ['tenny'], helped: [] };
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?skipIntro=1'); await click(page, 'home'); await ready(page, 'camp');
  await click(page, 'pet-tenny', 160); expect((await state(page)).onScreen).toContain('Tenny');
  await click(page, 'stop'); await ready(page, 'title');
});

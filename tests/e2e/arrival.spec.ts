import { expect, test } from '@playwright/test';
import { click, launch, ready, reviewFixture, state } from './helpers';

test('known doubles complete on arrival, announce Domi once, and keep the opening story', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome', 'ring']; save.settings.sound = false;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1&seed=7');
  const pebble = await ready(page, 'map');
  expect(pebble.team).not.toContain('domi');
  expect(pebble.clearedSpots.some(id => id.startsWith('tf-'))).toBe(false);
  await click(page, 'pp-gate');
  const arrival = await ready(page, 'map');
  expect(arrival).toMatchObject({ area: 2, animating: false, modal: true, nextStop: 'tf-falls', arrivalJoined: ['domi'], speechId: 'join-domi', markerIndex: 0 });
  expect(arrival.onScreen).toContain('Domi joins your team!');
  expect(arrival.stops.find(s => s.id === 'tf-add-doubles-small')).toMatchObject({ completed: true, state: 'locked', progress: 1 });
  expect(arrival.completedBeats).not.toContain('falls'); expect(arrival.team).toContain('domi');
  await click(page, 'close'); await click(page, 'tf-falls');
  expect(await ready(page, 'story')).toMatchObject({ speaker: 'twoot', line: 0 });
  await launch(page, '/?skipIntro=1&seed=7');
  expect(await ready(page, 'map')).toMatchObject({ area: 2, modal: false, arrivalJoined: [] });
  expect((await state(page)).team).toContain('domi');
});

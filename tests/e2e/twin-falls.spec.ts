import { expect, test } from '@playwright/test';
import { click, finishEncounter, launch, ready, reviewFixture, state, step, story, warmup } from './helpers';

test('gate one opens Twin Falls, Twoot shows the clues, and both arches and camp work', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome', 'ring']; save.settings.sound = false;
  save.facts['dots:1:dice']!.stage = 'learning';
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1&seed=7'); await ready(page, 'map');
  await click(page, 'pp-gate'); const falls = await ready(page, 'map');
  expect(falls).toMatchObject({ area: 2, background: 'bg-twin-falls-map', nextStop: 'tf-falls', entry: { needsHelp: true } });
  expect(falls.completedBeats).toContain('gate');
  expect(falls.onScreen).toContain('Domi joins your team!'); await click(page, 'close');
  await click(page, 'tf-falls'); expect(await ready(page, 'story')).toMatchObject({ speaker: 'twoot', listener: 'tenny', background: 'bg-twin-falls-encounter' });
  expect((await state(page)).onScreen[0]).toBe('Hoo! You made it to Twin Falls.');
  await story(page);
  await click(page, 'tf-add-doubles-small'); await warmup(page); await click(page, 'tf-add-doubles-small');
  expect(await ready(page, 'encounter')).toMatchObject({ background: 'bg-twin-falls-encounter', wild: 'domi', area: 2 });
  await finishEncounter(page); await click(page, 'map'); await ready(page, 'map');
  await click(page, 'tf-den'); expect(await ready(page, 'story')).toMatchObject({ speaker: 'twoot', background: 'bg-twin-falls-den', pageHighlighted: false });
  await click(page, 'next'); expect((await state(page)).wallsHighlighted).toBe(true);
  await click(page, 'next'); expect((await state(page)).pageHighlighted).toBe(true);
  await story(page);
  await click(page, 'tf-mist'); await ready(page, 'story');
  await click(page, 'next'); expect((await state(page)).shapeShown).toBe(true);
  await click(page, 'next'); expect((await state(page)).shapeGone).toBe(false);
  await click(page, 'next'); expect((await state(page)).shapeGone).toBe(true);
  await click(page, 'next'); expect(await state(page)).toMatchObject({ line: 4, shapeShown: false, shapeGone: true });
  await story(page);
  await click(page, 'home'); expect(await ready(page, 'camp')).toMatchObject({ area: 2, background: 'bg-twin-falls-encounter' });
  await click(page, 'keepGoing'); await ready(page, 'map');
  await launch(page, '/?skipIntro=1&seed=7'); expect(await ready(page, 'map')).toMatchObject({ area: 2 });
  await click(page, 'tf-entry'); expect(await ready(page, 'map')).toMatchObject({ area: 1, markerIndex: 11 });
  await click(page, 'pp-gate'); expect(await ready(page, 'map')).toMatchObject({ area: 2 });
});

test('an old gate-practice save reaches Twin Falls and the last gate keeps offering practice', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome', 'ring', 'gate', 'falls', 'den', 'mist'];
  save.map.gatePracticeIndex = 3; save.settings.sound = false;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1'); await ready(page, 'map');
  await click(page, 'pp-gate'); const twin = await ready(page, 'map');
  expect(twin).toMatchObject({ area: 2, nextStop: 'tf-gate' });
  expect(twin.onScreen).toContain('Domi joins your team!'); await click(page, 'close');
  // The panels follow a save, which finishes in real time, so poll instead of reading once.
  const shown = () => expect.poll(async () => { await step(page, 100); return (await state(page)).onScreen; });
  await click(page, 'tf-gate'); await ready(page, 'map'); await shown().toContain('The path is clear!');
  await click(page, 'close'); await shown().toContain('A new path will come soon.');
  await click(page, 'close'); await warmup(page); await click(page, 'tf-gate');
  expect(await ready(page, 'encounter')).toMatchObject({ background: 'bg-twin-falls-encounter' });
});

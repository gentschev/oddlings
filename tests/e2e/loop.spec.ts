import { test, expect } from '@playwright/test';
import { click, finishEncounter, launch, questionReady, ready, reviewFixture, state, step, story, warmup } from './helpers';

test('fresh play cascades skill completions, animates the marker and preserves progress on reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await launch(page); await click(page, 'play'); await ready(page, 'choosePartner');
  await click(page, 'tenny'); await click(page, 'pick'); await warmup(page);
  await click(page, 'pp-welcome'); await story(page);
  await click(page, 'pp-see-dots'); await finishEncounter(page);
  const reward = await state(page);
  expect(reward.completed.length).toBeGreaterThan(1);
  expect(reward.onScreen[0]).toBe(`You cleared ${reward.completed.length} stops!`);
  expect(reward.team).toContain('bix');
  expect(reward.joinedPals).toEqual(['bix', 'inch']);
  expect(reward.shownPals).toEqual(reward.joinedPals);
  expect(reward.onScreen[1]).toBe('2 pals join your team!');
  expect(reward.helped).toEqual(['bix']);
  await click(page, 'map'); const map = await ready(page, 'map');
  expect(map.markerIndex).toBe(map.stops.findIndex(s => s.state === 'current'));
  expect(map.stops.find(s => s.id === 'pp-see-dots')).toMatchObject({ state: 'complete', progress: 1, pal: 'bix', set: 'see-dots', tag: 'dots' });
  await launch(page, '/?skipIntro=1&seed=123'); const restored = await ready(page, 'map');
  expect(restored.clearedSpots).toEqual(map.clearedSpots); expect(restored.team).toEqual(map.team);
  expect(restored.markerIndex).toBe(restored.stops.findIndex(s => s.state === 'current'));
  expect(restored.helped).toEqual(['bix']);
  // A reload starts a new session, so the first stop tap goes through the warm-up.
  await click(page, 'pp-add-plus1'); await warmup(page); await click(page, 'pp-add-plus1');
  const inch = await ready(page, 'encounter');
  expect(inch).toMatchObject({ intro: true, wild: 'inch', speechId: 'muddle-inch' });
  expect(inch.onScreen).toEqual(['Inch is in a muddle!\nFill the dots to help.']);
  await finishEncounter(page); await click(page, 'map'); await ready(page, 'map');
  await click(page, 'pp-ring'); await story(page);
  await click(page, 'pp-sub-within5');
  const fivel = await ready(page, 'encounter');
  expect(fivel).toMatchObject({ intro: true, wild: 'fivel', speechId: 'muddle-fivel' });
  expect(errors).toEqual([]);
});

test('plain review pulses at eight seconds and models at twenty without an error', async ({ page }) => {
  const fixture = reviewFixture(); fixture.story.completedBeats = ['welcome'];
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(fixture));
  await launch(page, '/?seed=12&skipIntro=1');
  await click(page, 'pp-see-dots'); await warmup(page);
  await click(page, 'pp-see-dots'); const s = await questionReady(page);
  expect(s).toMatchObject({ presentation: 'plain', modelVisible: false, responses: 0, factId: 'add:4+1', question: { text: '4 + 1 = ?' } });
  await step(page, 8200); expect((await state(page)).hintPulsing).toBe(true);
  await step(page, 12000); expect(await state(page)).toMatchObject({ modelVisible: true, responses: 0, meter: s.meter, inputAccepted: true });
  await click(page, `answer-${s.correctAnswer}`, 1100); await finishEncounter(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('oddlings-save')!).responses);
  expect(saved[0]).toMatchObject({ neededHelp: true, score: 0, latency: null, correct: true });
});

test('touch-only partner and warm-up controls work', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
  const page = await context.newPage();
  await launch(page); await click(page, 'play', 600, true);
  await click(page, 'domi', 600, true); await click(page, 'pick', 600, true); await warmup(page, true);
  expect((await state(page)).profile.partner).toBe('domi'); await context.close();
});

test('the house opens camp with equal choices and the Oddbook', async ({ page }) => {
  await launch(page, '/?skipIntro=1&fresh=1');
  await click(page, 'home'); await ready(page, 'camp');
  const camp = await state(page), stop = camp.controls.find(c => c.id === 'stop')!, keep = camp.controls.find(c => c.id === 'keepGoing')!;
  expect([stop.width, stop.height]).toEqual([keep.width, keep.height]);
  await click(page, 'oddbook'); await ready(page, 'oddbook'); await click(page, 'back'); await ready(page, 'camp');
  await click(page, 'keepGoing'); await ready(page, 'map');
});

test('Oddbook changes the partner and the encounter uses it when another pal is muddled', async ({ page }) => {
  const fixture = reviewFixture(); fixture.story.completedBeats = ['welcome'];
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(fixture));
  await launch(page, '/?skipIntro=1&seed=12'); await click(page, 'oddbook'); await ready(page, 'oddbook');
  expect((await state(page)).cards?.find(c => c.id === 'domi')).toMatchObject({ met: false, progress: null });
  await click(page, 'partner-bix'); await ready(page, 'oddbook'); await click(page, 'back'); await ready(page, 'map');
  await click(page, 'pp-see-frame'); await warmup(page); await click(page, 'pp-see-frame');
  expect(await questionReady(page)).toMatchObject({ partner: 'bix', partnerPattern: 'dice', wild: 'tenny' });
});

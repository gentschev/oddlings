import { expect, test, type Page } from '@playwright/test';
import { createSave, getArea } from '../../src/core';
import { click, launch, questionReady, ready, reviewFixture, state, step, warmup } from './helpers';

async function freshRound(page: Page) {
  const save = createSave(); save.team.partner = 'tenny'; save.team.friends = ['tenny'];
  save.story.completedBeats = ['welcome']; save.settings.sound = false;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1&seed=123'); await click(page, 'pp-see-dots'); await warmup(page);
  const map = await state(page);
  await click(page, 'pp-see-dots'); await ready(page, 'encounter');
  const intro = await state(page), back = intro.controls.find(c => c.id === 'back')!;
  expect(intro.intro).toBe(true); expect(back.enabled).toBe(false);
  // The hidden arrow leaves this spot inside the introduction's tap-anywhere target.
  await page.mouse.click(back.x, back.y); await step(page, 300);
  expect((await state(page)).leaving).toBe(false);
  await questionReady(page); return map;
}

for (const area of [1, 2]) test(`map back and Play keep area ${area}, including the first warm-up and later returns`, async ({ page }) => {
  const save = reviewFixture(); save.settings.sound = false;
  save.story.completedBeats = area === 2 ? ['welcome', 'ring', 'gate'] : ['welcome']; save.map.area = area;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1'); const before = await ready(page, 'map');
  await click(page, 'back'); expect(await ready(page, 'title')).toMatchObject({ scene: 'title', area });
  await click(page, 'play'); await warmup(page);
  expect(await state(page)).toMatchObject({ scene: 'map', area, markerIndex: before.markerIndex });
  await click(page, 'back'); await ready(page, 'title'); await click(page, 'play');
  expect(await ready(page, 'map')).toMatchObject({ area, markerIndex: before.markerIndex });
});

test('Keep going resumes the same plain question and records correctness without speed', async ({ page }) => {
  const save = reviewFixture(); save.story.completedBeats = ['welcome']; save.settings.sound = false;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?skipIntro=1&seed=12'); await click(page, 'pp-see-dots'); await warmup(page);
  await click(page, 'pp-see-dots'); const before = await questionReady(page);
  expect(before.modelVisible).toBe(false);
  await click(page, 'back'); const panel = await state(page);
  expect(panel).toMatchObject({ leaving: true, modal: true, phase: before.phase, responses: before.responses, inputAccepted: false });
  expect(panel.controls.map(c => c.id)).toEqual(['back', 'leave-yes', 'leave-no']);
  expect(panel.pad.every(c => !c.enabled)).toBe(true);
  const yes = panel.controls.find(c => c.id === 'leave-yes')!, no = panel.controls.find(c => c.id === 'leave-no')!;
  expect([yes.width, yes.height]).toEqual([no.width, no.height]);
  await step(page, 25000);
  expect(await state(page)).toMatchObject({ factId: before.factId, modelVisible: false, hintPulsing: false });
  await click(page, 'leave-no');
  expect(await state(page)).toMatchObject({ leaving: false, modal: false, factId: before.factId, phase: before.phase,
    inputAccepted: true, modelVisible: before.modelVisible, responses: before.responses });
  await click(page, `answer-${before.correctAnswer}`, 1100); await questionReady(page);
  expect((await state(page)).responses).toBe(before.responses + 1);
  await click(page, 'back'); await click(page, 'leave-yes'); await ready(page, 'map');
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('oddlings-save')!).responses);
  expect(log[0]).toMatchObject({ correct: true, latency: null, score: 0.5 });
});

test('dropping after two answers keeps the current stone and the next round starts empty', async ({ page }) => {
  const map = await freshRound(page);
  for (let i = 0; i < 2; i++) {
    const q = await questionReady(page); await click(page, `answer-${q.correctAnswer}`, 1100);
  }
  await questionReady(page); expect((await state(page)).responses).toBe(2);
  await click(page, 'back'); await click(page, 'leave-yes');
  const returned = await ready(page, 'map');
  expect(returned).toMatchObject({ responses: 2, markerIndex: map.markerIndex, nextStop: 'pp-see-dots', banner: '', modal: false, animating: false });
  expect(returned.team).toEqual(map.team); expect(returned.helped).toEqual([]);
  expect(returned.stops.find(s => s.id === 'pp-see-dots')).toMatchObject({ state: 'current', completed: false, progress: 1 });
  await click(page, 'pp-see-dots'); const next = await questionReady(page);
  expect(next).toMatchObject({ responses: 2, meter: next.initialMeter, intro: false });
  expect(next.slots.every(filled => !filled)).toBe(true);
});

for (const phase of ['second', 'correction']) test(`the leave check resumes and drops a ${phase} try without extra evidence`, async ({ page }) => {
  const map = await freshRound(page), first = await questionReady(page);
  await click(page, `answer-${(first.correctAnswer + 1) % 21}`, 300);
  if (phase === 'correction') await click(page, `answer-${(first.correctAnswer + 2) % 21}`, 300);
  const before = await state(page); expect(before.phase).toBe(phase);
  await click(page, 'back'); await step(page, 21000); await click(page, 'leave-no');
  expect(await state(page)).toMatchObject({ leaving: false, factId: before.factId, phase, modelVisible: true,
    responses: 1, inputAccepted: true, disabledAnswers: before.disabledAnswers, meter: before.meter });
  await click(page, 'back'); await click(page, 'leave-yes');
  expect(await ready(page, 'map')).toMatchObject({ responses: 1, markerIndex: map.markerIndex,
    nextStop: 'pp-see-dots', banner: '', modal: false, animating: false });
  await click(page, 'pp-see-dots'); const next = await questionReady(page);
  expect(next).toMatchObject({ responses: 1, meter: next.initialMeter, intro: false });
});

test.describe('dense-screen back button', () => {
  test.use({ deviceScaleFactor: 2 });
  test('does not skip an animation, then leaves a skip banner with one tap', async ({ page }) => {
    const save = reviewFixture(); save.settings.sound = false;
    await page.addInitScript(json => {
      if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
    }, JSON.stringify(save));
    await launch(page, '/?skipIntro=1'); await click(page, 'pp-welcome'); await ready(page, 'story');
    const lines = getArea(1).stories.welcome!.lines;
    for (let i = 0; i < lines.length; i++) await click(page, 'next', 0);
    for (let i = 0; (await state(page)).scene !== 'map' && i < 80; i++) {
      await step(page, 20); await page.waitForTimeout(5);
    }
    const moving = await state(page), back = moving.controls.find(c => c.id === 'back')!;
    expect(moving).toMatchObject({ scene: 'map', animating: true }); expect(back.enabled).toBe(false);
    await page.mouse.click(back.x, back.y); await step(page, 60);
    expect(await state(page)).toMatchObject({ scene: 'map', animating: true });
    const arrived = await ready(page, 'map'); expect(arrived.banner).not.toBe('');
    await click(page, 'back'); await ready(page, 'title'); await step(page, 4000);
    expect((await state(page)).scene).toBe('title');
    await click(page, 'play'); await warmup(page);
    expect(await state(page)).toMatchObject({ area: 1, markerIndex: arrived.markerIndex, banner: '', modal: false });
  });
});

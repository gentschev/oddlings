import { expect, test } from '@playwright/test';
import { createSave, getSet, newFactState } from '../../src/core';
import { PRAISE_LINES, STRINGS } from '../../src/game/strings';
import { click, launch, questionReady, ready, reviewFixture, state, step, warmup } from './helpers';

test('silent introductions wait or skip on a tap, earned dots fix the friend, and replays skip the intro', async ({ page }) => {
  const save = createSave(); save.team = { partner: 'tenny', friends: ['tenny'], helped: [] }; save.settings.sound = false;
  save.story.completedBeats = ['welcome']; save.map.clearedSpots = ['pp-welcome']; save.map.position = 'pp-welcome';
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(save));
  await launch(page, '/?seed=12&skipIntro=1');
  await click(page, 'pp-see-dots'); await warmup(page);
  await click(page, 'pp-see-dots'); const intro = await ready(page, 'encounter');
  expect(intro).toMatchObject({ phase: 'intro', intro: true, inputAccepted: false, responses: 0 });
  expect(intro.onScreen).toEqual(['Bix is in a muddle!\nFill the dots to help.']);
  expect(intro.slots).toEqual(Array(intro.initialMeter).fill(false));
  expect(intro.controls.filter(c => c.id.startsWith('answer-')).every(c => !c.enabled)).toBe(true);
  await step(page, 800); expect((await state(page)).phase).toBe('intro');
  await step(page, 1800); const question = await questionReady(page);
  expect(question).toMatchObject({ intro: false, responses: 0, questionText: 'How many dots?' });
  // Slow enough to choose an effort line, with the same text and speech id.
  await step(page, 4500);
  await click(page, `answer-${question.correctAnswer}`, 100);
  const feedback = await state(page);
  expect(feedback.slots.filter(Boolean)).toHaveLength(feedback.initialMeter - feedback.meter);
  expect(feedback.feedback).toBe(PRAISE_LINES[Number(feedback.speechId.slice('praise-'.length))]);
  for (let i = 0; i < 80; i++) {
    const s = await state(page);
    if (s.phase === 'complete') break;
    if (s.inputAccepted) await click(page, `answer-${s.correctAnswer}`, 100);
    else await step(page, 300);
  }
  const complete = await state(page);
  expect(complete).toMatchObject({ phase: 'complete', meter: 0, speechId: 'ui-clear', friendRestored: false });
  expect(complete.slots.every(Boolean)).toBe(true);
  await step(page, 650); expect((await state(page)).friendRestored).toBe(true);
  await step(page, 1000); await ready(page, 'reward');
  await click(page, 'map'); await ready(page, 'map');
  await click(page, 'pp-see-dots'); const replay = await ready(page, 'encounter');
  expect(replay.intro).toBe(false); expect(replay.controls.some(c => c.id === 'intro-continue')).toBe(false);
  // The replay goes straight to its first question.
  await questionReady(page);
});

test('a new encounter introduction can be skipped without answering its first question', async ({ page }) => {
  const save = reviewFixture(); save.settings.sound = false;
  for (const id of getSet('see-dots').facts) save.facts[id] = newFactState(id);
  save.story.completedBeats = ['welcome']; save.map.clearedSpots = ['pp-welcome']; save.map.position = 'pp-welcome';
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?seed=12&skipIntro=1');
  await click(page, 'pp-see-dots'); await warmup(page);
  await click(page, 'pp-see-dots'); await ready(page, 'encounter');
  expect((await state(page)).intro).toBe(true);
  await click(page, 'intro-continue', 300);
  expect(await state(page)).toMatchObject({ intro: false, inputAccepted: true, responses: 0, questionText: 'How many dots?' }); // The unseen set opens with its own entry check.
  expect((await state(page)).onScreen).not.toContain(STRINGS.muddle(STRINGS.names.bix));
});

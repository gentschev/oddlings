import { expect, test } from '@playwright/test';
import { click, launch, questionReady, ready, reviewFixture, state, step, warmup } from './helpers';

for (const partner of ['domi', 'twoot']) test(`${partner} rests on plain questions and the wild pal keeps empty outlines until delivery`, async ({ page }) => {
  const save = reviewFixture('sub:5-5'); save.settings.sound = false;
  save.team = { partner, friends: [partner, 'bix'], helped: [] }; save.story.completedBeats = ['welcome', 'ring'];
  await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
  await launch(page, '/?skipIntro=1&seed=123');
  await click(page, 'pp-see-dots'); await warmup(page);
  await click(page, 'pp-see-dots'); await questionReady(page);
  expect(await state(page)).toMatchObject({ partner, factId: 'sub:5-5', modelVisible: false, helperPatternMode: 'resting', wildPatternMode: 'muddled' });
  await step(page, 300); await page.screenshot({ path: `test-results/pattern-${partner}-plain.png` });
  await click(page, 'hint', 100);
  expect(await state(page)).toMatchObject({ modelVisible: true, helperPatternMode: 'fact', wildPatternMode: 'muddled' });
  await page.screenshot({ path: `test-results/pattern-${partner}-modeled.png` });
  await click(page, 'answer-0', 100); await step(page, 1100); await questionReady(page);
  expect(await state(page)).toMatchObject({ modelVisible: false, helperPatternMode: 'resting', wildPatternMode: 'muddled' });
  for (let n = 0; n < 80; n++) {
    const s = await state(page);
    if (s.phase === 'complete') break;
    if (s.inputAccepted) await click(page, `answer-${s.correctAnswer}`, 100);
    else await step(page, 300);
  }
  expect(await state(page)).toMatchObject({ phase: 'complete', wildPatternMode: 'muddled', friendRestored: false });
  await step(page, 650);
  expect(await state(page)).toMatchObject({ wildPatternMode: 'resting', friendRestored: true });
  await page.screenshot({ path: `test-results/pattern-${partner}-restored.png` });
  await step(page, 1000); await ready(page, 'reward');
});

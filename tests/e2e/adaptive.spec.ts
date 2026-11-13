import { expect, test } from '@playwright/test';
import oldSave from '../fixtures/save-v1-path-cleared.json' with { type: 'json' };
import { click, launch, questionReady, ready, state, step, warmup } from './helpers';

test('a migrated learned stop shows part credit and a spoken progress reward', async ({ page }) => {
  const fixture = structuredClone(oldSave); fixture.settings.sound = false;
  await page.addInitScript(json => {
    if (!localStorage.getItem('oddlings-save')) localStorage.setItem('oddlings-save', json);
  }, JSON.stringify(fixture));
  await launch(page, '/?skipIntro=1&seed=7');
  const map = await ready(page, 'map'), before = map.stops.find(s => s.id === 'pp-add-plus0')!.progress!;
  await click(page, 'pp-add-plus0'); await warmup(page); await click(page, 'pp-add-plus0');
  expect((await questionReady(page)).presentation).toBe('plain');
  for (let i = 0; i < 100; i++) {
    const s = await state(page);
    if (s.scene === 'reward') break;
    if (s.inputAccepted) {
      await step(page, 6000); await click(page, `answer-${s.correctAnswer}`, 100);
    } else await step(page, 300);
  }
  const reward = await ready(page, 'reward');
  expect(reward.completed).toEqual([]);
  expect(reward.onScreen[0]).toBe('Inch is getting better!');
  await click(page, 'map'); const after = await ready(page, 'map');
  expect(after.stops.find(s => s.id === 'pp-add-plus0')!.progress).toBeGreaterThan(before);
});

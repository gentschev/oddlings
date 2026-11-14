import { expect, test } from '@playwright/test';
import { click, launch, questionReady, reviewFixture, state, step, warmup } from './helpers';

for (const secondRight of [false, true]) {
  test(secondRight ? 'a wrong then right answer praises effort without filling a slot' : 'wrong, wrong, correction tap logs only the first answer', async ({ page }) => {
    const save = reviewFixture(); save.story.completedBeats = ['welcome']; save.settings.sound = false;
    await page.addInitScript(json => localStorage.setItem('oddlings-save', json), JSON.stringify(save));
    await launch(page, '/?skipIntro=1&seed=12');
    await click(page, 'pp-see-dots'); await warmup(page); await click(page, 'pp-see-dots');
    const first = await questionReady(page), wrong = (first.correctAnswer + 1) % 21;
    await click(page, `answer-${wrong}`, 250);
    const second = await state(page);
    expect(second).toMatchObject({ phase: 'second', modelVisible: true, inputAccepted: true,
      factId: first.factId, responses: first.responses + 1, meter: first.meter,
      disabledAnswers: [wrong], feedback: 'Look and try again.', speechId: 'ui-tryAgain' });
    expect(second.controls.find(c => c.id === 'hint')?.enabled).toBe(false);
    const refused = second.controls.find(c => c.id === `answer-${wrong}`)!;
    await page.mouse.click(refused.x, refused.y); await step(page, 100);
    expect(await state(page)).toMatchObject({ phase: 'second', responses: first.responses + 1 });
    if (secondRight) {
      await click(page, `answer-${first.correctAnswer}`, 100);
      expect(await state(page)).toMatchObject({ feedback: 'You worked it out!', speechId: 'praise-0', meter: first.meter, responses: first.responses + 1 });
    } else {
      await click(page, `answer-${(first.correctAnswer + 2) % 21}`, 250);
      const correction = await state(page);
      expect(correction).toMatchObject({ phase: 'correction', modelVisible: true, factId: first.factId,
        responses: first.responses + 1, meter: first.meter, feedback: `Tap ${first.correctAnswer} to go on.` });
      expect(correction.controls.filter(c => c.id.startsWith('answer-') && c.enabled).map(c => c.id)).toEqual([`answer-${first.correctAnswer}`]);
      await click(page, `answer-${first.correctAnswer}`, 100);
    }
    const next = await questionReady(page);
    expect(next.factId).not.toBe(first.factId);
    expect(next).toMatchObject({ phase: 'question', meter: first.meter, responses: first.responses + 1, disabledAnswers: [] });
  });
}

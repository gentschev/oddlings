import { expect, it } from 'vitest';
import { applyAnswer, createSave, currentSlot, getFact, getSet, recordSetStreak, seededRandom, setPassed,
  startEncounter, startSession, submitAnswer, type Response } from '../../src/core';
import { masterThrough } from './helpers';

it('does not pass a check or a set streak in 200 encounters of random pad taps', () => {
  const save = createSave(), random = seededRandom(7), child = seededRandom(45);
  let now = 0; startSession(save, now);
  for (let index = 0; index < 200; index++) {
    const encounter = startEncounter(save, now, random);
    let turns = 0;
    while (encounter.phase !== 'complete') {
      expect(++turns).toBeLessThan(2000);
      const fact = getFact(currentSlot(encounter).factId), answer = Math.floor(child.next() * 21);
      submitAnswer(save, encounter, answer, now += 1200, 'day', random);
      if (encounter.phase === 'correction') submitAnswer(save, encounter, fact.answer, now += 1000, 'day', random);
    }
    expect(Object.values(save.practice.checks ?? {}).some(c => c.status === 'passed')).toBe(false);
    expect(Object.values(save.facts).some(f => f.provisional)).toBe(false);
    expect(setPassed(save, 'see-dots')).toBe(false);
  }
}, 60_000);
it('uses evidence of plus zero without inferring knowledge of plus two', () => {
  const save = createSave(); startSession(save, 0); masterThrough(save, 'see-frame');
  const zero = getSet('add-plus0').facts;
  for (const id of zero.slice(0, 2)) Object.assign(save.facts[id]!, { stage: 'learning', seen: 1, firstTryCorrect: 0 });
  for (const id of zero.slice(2, 7)) {
    save.facts[id] = applyAnswer(save.facts[id]!, { now: 1000, localDate: 'day', encounterId: 'a', correct: true,
      hintUsed: false, latency: 1200, hidden: false, mode: 'plain' }, 1500).fact;
    recordSetStreak(save, line(id, 'add-plus0', true));
  }
  expect(setPassed(save, 'add-plus0')).toBe(true);
  masterThrough(save, 'sub-minus01');
  for (const id of getSet('add-plus2').facts.filter(id => save.facts[id]!.stage === 'new')) {
    recordSetStreak(save, line(id, 'add-plus2', false));
  }
  expect(setPassed(save, 'add-plus2')).toBe(false);
  expect(getSet('add-plus2').facts.some(id => save.facts[id]!.provisional)).toBe(false);
});
function line(factId: string, setId: string, correct: boolean): Response {
  return { factId, setId, correct, firstTryCorrect: correct, neededHelp: false, latency: 1200, mode: 'plain',
    time: 1000, score: correct ? 1 : 0, encounterId: 'a' };
}

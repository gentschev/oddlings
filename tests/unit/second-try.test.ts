import { describe, expect, it } from 'vitest';
import { createSave, currentSession, currentSlot, disabledAnswers, encounterSnapshot, getFact, markEncounterHidden,
  revealHint, seededRandom, startEncounter, startSession, submitAnswer } from '../../src/core';
import { fixture, masterThrough } from './helpers';

function question(factId = 'add:5+0', mode: 'plain' | 'modeled' = 'plain', placement = false) {
  const save = fixture(); masterThrough(save, 'add-plus1');
  const random = seededRandom(4), encounter = startEncounter(save, 0, random);
  encounter.slots[0] = { factId, mode, source: placement ? 'placement' : 'known', setId: factId.startsWith('dots:') ? 'see-dots' : factId.startsWith('frame:') ? 'see-frame' : 'add-plus0' };
  encounter.modelVisible = mode === 'modeled';
  const answer = getFact(factId).answer;
  const tap = (n: number, time = 1000) => submitAnswer(save, encounter, n, time, 'day', random);
  return { save, encounter, answer, tap };
}

describe('second try', () => {
  it.each([
    ['add:5+0', 'plain'], ['add:5+0', 'modeled'], ['dots:2:dice', 'plain'], ['frame:2', 'modeled'],
  ] as const)('shows the model and same question after a first miss on %s (%s)', (id, mode) => {
    const { save, encounter, answer, tap } = question(id, mode);
    tap(answer + 1);
    expect(encounter).toMatchObject({ phase: 'second', modelVisible: true, index: 0, answered: 1, meter: 8 });
    expect(currentSlot(encounter).factId).toBe(id);
    expect(encounterSnapshot(encounter)).toMatchObject({ phase: 'second', disabledAnswers: [answer + 1],
      onScreen: { correctionAnswer: null, modelVisible: true } });
    expect(save.responses).toHaveLength(1);
    expect(save.responses[0]).toMatchObject({ correct: false, neededHelp: false, latency: 1000, mode });
  });
  it('refuses the same wrong answer and preserves all first-try evidence on extra wrong taps', () => {
    const { save, encounter, answer, tap } = question('add:5+0', 'plain', true);
    tap(answer + 1);
    const snapshot = structuredClone(save), evidence = { shownAt: encounter.shownAt, hintUsed: encounter.hintUsed, hidden: encounter.hidden };
    expect(currentSession(save).retries.filter(r => r.factId === currentSlot(encounter).factId)).toHaveLength(1);
    expect(tap(answer + 1, 2000).accepted).toBe(false); expect(encounter.phase).toBe('second');
    revealHint(encounter); markEncounterHidden(encounter);
    expect(encounter).toMatchObject(evidence);
    tap(answer + 2, 3000); expect(encounter.phase).toBe('correction');
    expect(encounterSnapshot(encounter).onScreen.correctionAnswer).toBe(answer);
    expect(disabledAnswers(encounter)).toHaveLength(20); expect(disabledAnswers(encounter)).not.toContain(answer);
    expect(tap(answer + 2, 4000).accepted).toBe(false);
    expect(save).toEqual(snapshot); expect(encounter).toMatchObject({ answered: 1, meter: 8, ...evidence });
  });
  it.each(['second', 'correction'] as const)('moves on after a right %s answer without scoring it or clearing a slot', phase => {
    const { save, encounter, answer, tap } = question();
    tap(answer + 1);
    if (phase === 'correction') tap(answer + 2, 2000);
    const snapshot = structuredClone(save);
    tap(answer, 3000);
    expect(encounter).toMatchObject({ phase: 'question', index: 1, answered: 1, meter: 8, wrongAnswer: null });
    expect(save).toEqual(snapshot); expect(disabledAnswers(encounter)).toEqual([]);
    expect(save.responses).toHaveLength(1);
  });
  it.each([true, false])('does not score another entry probe or set streak when the second answer is right: %s', secondRight => {
    const save = createSave(); startSession(save, 0);
    const random = seededRandom(8), encounter = startEncounter(save, 0, random);
    const slot = currentSlot(encounter), answer = getFact(slot.factId).answer;
    expect(slot.source).toBe('placement');
    submitAnswer(save, encounter, answer + 1, 1000, 'day', random);
    expect(save.practice.checks![slot.setId]!.results).toEqual([false]);
    const snapshot = structuredClone(save);
    if (!secondRight) submitAnswer(save, encounter, answer + 2, 2000, 'day', random);
    submitAnswer(save, encounter, answer, 3000, 'day', random);
    expect(save).toEqual(snapshot);
    expect(encounter.answered).toBe(1);
    expect(currentSession(save).retries.filter(r => r.factId === slot.factId)).toHaveLength(1);
    expect(encounter.meter).toBe(encounter.initialMeter);
  });
  it('keeps a voluntary first-try hint and hidden timing unchanged on later tries', () => {
    const { save, encounter, answer, tap } = question();
    revealHint(encounter); markEncounterHidden(encounter); tap(answer + 1);
    const first = structuredClone(save.responses[0]); tap(answer + 2, 25000); tap(answer, 26000);
    expect(save.responses).toEqual([first]);
    expect(first).toMatchObject({ neededHelp: true, latency: null, correct: false });
  });
});

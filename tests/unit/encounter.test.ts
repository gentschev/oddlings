import { describe, expect, it } from 'vitest';
import {
  advanceEncounterTime, consumeRetry, currentSession, currentSlot, encounterSnapshot, getFact,
  markEncounterHidden, readyRetries, revealHint, scheduleRetry, seededRandom, startEncounter, submitAnswer,
} from '../../src/core';
import { fixture, masterSet } from './helpers';

describe('retry queue', () => {
  it('spaces a fact after two others, six more, then a later encounter, with no duplicates', () => {
    const save = fixture(); const session = currentSession(save);
    session.questions = 1; session.encounters = 1;
    scheduleRetry(save, 'dots:1:dice'); scheduleRetry(save, 'dots:1:dice');
    expect(session.retries).toHaveLength(1);
    expect(readyRetries(save)).toHaveLength(0);
    session.questions = 2; expect(readyRetries(save)).toHaveLength(0);
    session.questions = 3; expect(readyRetries(save)).toHaveLength(1);
    consumeRetry(save, 'dots:1:dice');
    expect(session.retries[0]).toMatchObject({ step: 1, afterQuestion: 10 });
    session.questions = 9; expect(readyRetries(save)).toHaveLength(0);
    session.questions = 10; consumeRetry(save, 'dots:1:dice');
    session.questions = 20; expect(readyRetries(save)).toHaveLength(0);
    session.encounters = 2; expect(readyRetries(save)).toHaveLength(1);
    consumeRetry(save, 'dots:1:dice'); expect(session.retries).toHaveLength(0);
  });
});
describe('encounter turns', () => {
  it('models ordinary teaching after failed checks and rewards fast and slow answers with two and one puffs', () => {
    const save = fixture(); const rng = seededRandom(1);
    const encounter = startEncounter(save, 0, rng);
    expect(encounter.modelVisible).toBe(true);
    expect(currentSlot(encounter).mode).toBe('modeled');
    const id = currentSlot(encounter).factId;
    submitAnswer(save, encounter, getFact(id).answer, 1000, '2026-11-12', rng);
    expect(encounter.meter).toBe(6);
    expect(save.facts[id]!.stage).toBe('learning');
    expect(currentSession(save).retries.some(r => r.factId === id)).toBe(true);
    submitAnswer(save, encounter, getFact(currentSlot(encounter).factId).answer, 6000, '2026-11-12', rng);
    expect(encounter.meter).toBe(5);
  });
  it('records a miss once, shows the worked answer, and requires its correction without reducing the meter', () => {
    const save = fixture(); const rng = seededRandom(1);
    const encounter = startEncounter(save, 0, rng);
    const id = currentSlot(encounter).factId; const correct = getFact(id).answer;
    submitAnswer(save, encounter, correct + 1, 1000, '2026-11-12', rng);
    expect(encounter.phase).toBe('correction'); expect(encounter.meter).toBe(8);
    expect(encounterSnapshot(encounter).onScreen.correctionAnswer).toBe(correct);
    expect(encounterSnapshot(encounter).onScreen.workedExample?.result).toBe(correct);
    expect(submitAnswer(save, encounter, correct + 1, 1500, '2026-11-12', rng).accepted).toBe(false);
    submitAnswer(save, encounter, correct, 2000, '2026-11-12', rng);
    expect(encounter.phase).toBe('question'); expect(encounter.meter).toBe(8);
    expect(save.responses).toHaveLength(1); expect(save.facts[id]!.seen).toBe(1);
    expect(currentSlot(encounter).factId).not.toBe(id);
    const seen: string[] = [];
    while (encounter.phase !== 'complete' && seen.length < 12) {
      const next = currentSlot(encounter).factId;
      seen.push(next);
      submitAnswer(save, encounter, getFact(next).answer, encounter.shownAt + 5000, '2026-11-12', rng);
    }
    const retry = seen.indexOf(id);
    expect(retry).toBeGreaterThanOrEqual(2); expect(retry).toBeLessThanOrEqual(3);
    expect(save.responses.find((r, i) => i > 0 && r.factId === id)?.mode).toBe('modeled');
  });
  it('pulses hints at eight seconds, auto-models at twenty, and never times out', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(1);
    const encounter = startEncounter(save, 0, rng);
    expect(encounter.modelVisible).toBe(false);
    advanceEncounterTime(encounter, 7999); expect(encounter.hintPulsing).toBe(false);
    advanceEncounterTime(encounter, 8000); expect(encounter.hintPulsing).toBe(true);
    advanceEncounterTime(encounter, 20000);
    expect(encounter.modelVisible).toBe(true); expect(encounter.hintUsed).toBe(true);
    advanceEncounterTime(encounter, 90000); expect(encounter.phase).toBe('question');
    submitAnswer(save, encounter, getFact(currentSlot(encounter).factId).answer, 90000, '2026-11-12', rng);
    expect(save.responses[0]).toMatchObject({ score: 0, neededHelp: true, correct: true, firstTryCorrect: false, latency: null });
  });
  it('manual hints score help rather than wrong and hidden responses provide no timing evidence', () => {
    const save = fixture(); masterSet(save, 'see-dots'); const rng = seededRandom(1);
    const encounter = startEncounter(save, 0, rng);
    revealHint(encounter);
    submitAnswer(save, encounter, getFact(currentSlot(encounter).factId).answer, 1000, '2026-11-12', rng);
    expect(save.responses[0]).toMatchObject({ correct: true, score: 0, neededHelp: true });
    markEncounterHidden(encounter);
    submitAnswer(save, encounter, getFact(currentSlot(encounter).factId).answer, 2000, '2026-11-12', rng);
    expect(save.responses[1]!.latency).toBeNull(); expect(save.responses[1]!.score).toBe(0.5);
  });
  it('allows more questions after misses, then finishes with a zero meter and ignores further taps', () => {
    const save = fixture(); const rng = seededRandom(1); const encounter = startEncounter(save, 0, rng, 6);
    for (let i = 0; i < 6; i++) {
      const answer = getFact(currentSlot(encounter).factId).answer;
      submitAnswer(save, encounter, answer + 1, encounter.shownAt + 1000, '2026-11-12', rng);
      submitAnswer(save, encounter, answer, encounter.shownAt + 2000, '2026-11-12', rng);
    }
    expect(encounter.phase).toBe('question'); expect(encounter.meter).toBe(6);
    for (let i = 0; encounter.phase !== 'complete' && i < 20; i++) submitAnswer(save, encounter,
      getFact(currentSlot(encounter).factId).answer, encounter.shownAt + 5000, '2026-11-12', rng);
    expect(encounter.phase).toBe('complete'); expect(encounter.meter).toBe(0);
    expect(submitAnswer(save, encounter, 0, 100000, '2026-11-12', rng).accepted).toBe(false);
  });
});

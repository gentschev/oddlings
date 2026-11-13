import { describe, expect, it } from 'vitest';
import { applyAnswer, calibrate, DAY_MS, fastThreshold, isFluent, median, newFactState, REVIEW_INTERVALS_DAYS } from '../../src/core';
import type { AnswerEvidence, FactState } from '../../src/core';

function evidence(overrides: Partial<AnswerEvidence> = {}): AnswerEvidence {
  return { now: 1000, localDate: '2026-11-12', encounterId: 'a', correct: true,
    hintUsed: false, latency: 3000, hidden: false, mode: 'modeled', ...overrides };
}
describe('response evidence', () => {
  it.each([[3000, true, false, 1], [3501, true, false, 0.5], [3000, false, false, 0], [3000, true, true, 0]])('scores latency=%s correct=%s hint=%s as %s', (latency, correct, hintUsed, score) => {
    const before = { ...newFactState('add:2+3'), strength: 0.4 };
    const result = applyAnswer(before, evidence({ latency, correct, hintUsed }), 1500);
    expect(result.score).toBe(score);
    expect(result.fact.strength).toBeCloseTo(0.4 + 0.3 * (score - 0.4));
    expect(result.firstTryCorrect).toBe(correct && !hintUsed);
    expect(before.seen).toBe(0);
  });
  it('calibrates using the median of the last fifteen warm-up taps and clamps recall thresholds', () => {
    expect(median([])).toBe(1500);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(calibrate(Array.from({ length: 15 }, (_, i) => i), 100)).toEqual({ history: [...Array.from({ length: 14 }, (_, i) => i + 1), 100], baseline: 8 });
    expect(fastThreshold(100)).toBe(2500);
    expect(fastThreshold(1500)).toBe(3500);
    expect(fastThreshold(9000)).toBe(5000);
    expect(applyAnswer(newFactState('x'), evidence({ latency: 3500 }), 1500).fast).toBe(true);
  });
  it('keeps only five correct latencies, excludes long, hidden and wrong answers', () => {
    let fact = newFactState('x');
    for (let i = 0; i < 7; i++) fact = applyAnswer(fact, evidence({ latency: i + 1000 }), 1500).fact;
    expect(fact.latencies).toEqual([1002, 1003, 1004, 1005, 1006]);
    for (const overrides of [{ latency: 20001 }, { hidden: true }, { correct: false }]) {
      expect(applyAnswer(fact, evidence(overrides), 1500).fact.latencies).toEqual(fact.latencies);
    }
    expect(applyAnswer(fact, evidence({ latency: 20000 }), 1500).fact.latencies.at(-1)).toBe(20000);
    expect(applyAnswer(fact, evidence({ hidden: true }), 1500).fast).toBe(false);
  });
});
describe('stages and spacing', () => {
  it('requires three consecutive independent successes spanning two encounters', () => {
    let fact = newFactState('x');
    for (let i = 0; i < 3; i++) fact = applyAnswer(fact, evidence(), 1500).fact;
    expect(fact.stage).toBe('learning');
    fact = applyAnswer(fact, evidence({ encounterId: 'b' }), 1500).fact;
    expect(fact.stage).toBe('review');
    expect(fact.ladder).toBe(0);
    expect(fact.dueAt).toBe(1000 + DAY_MS);
  });
  it('resets the acquisition streak and encounter evidence on wrong answers and hints', () => {
    let fact = newFactState('x');
    fact = applyAnswer(fact, evidence(), 1500).fact;
    fact = applyAnswer(fact, evidence({ encounterId: 'b', hintUsed: true }), 1500).fact;
    expect(fact.streak).toBe(0);
    expect(fact.streakEncounters).toEqual([]);
    expect(fact.needsModel).toBe(true);
  });
  it('uses the exact review ladder, advances only when due, and caps at ninety days', () => {
    let fact: FactState = { ...newFactState('x'), stage: 'review', dueAt: DAY_MS };
    fact = applyAnswer(fact, evidence({ now: DAY_MS - 1 }), 1500).fact;
    expect(fact.dueAt).toBe(DAY_MS); expect(fact.ladder).toBe(0);
    for (let step = 1; step < REVIEW_INTERVALS_DAYS.length + 2; step++) {
      const now = fact.dueAt!;
      fact = applyAnswer(fact, evidence({ now }), 1500).fact;
      const index = Math.min(step, REVIEW_INTERVALS_DAYS.length - 1);
      expect(fact.ladder).toBe(index);
      expect(fact.dueAt).toBe(now + REVIEW_INTERVALS_DAYS[index]! * DAY_MS);
    }
  });
  it('returns lapses to learning then reacquires two ladder steps lower', () => {
    let fact: FactState = { ...newFactState('x'), stage: 'review', ladder: 4, dueAt: 0, fastDays: ['a', 'b', 'c'] };
    fact = applyAnswer(fact, evidence({ correct: false }), 1500).fact;
    expect(fact).toMatchObject({ stage: 'learning', streak: 0, lapses: 1, ladder: 4, dueAt: null, fastDays: ['a', 'b', 'c'] });
    for (const encounterId of ['a', 'a', 'b']) fact = applyAnswer(fact, evidence({ encounterId }), 1500).fact;
    expect(fact).toMatchObject({ stage: 'review', ladder: 2, dueAt: 1000 + 7 * DAY_MS });
  });
  it('derives fluency from review and three distinct local days', () => {
    let fact: FactState = { ...newFactState('x'), stage: 'review', dueAt: 1e10 };
    for (const localDate of ['2026-11-12', '2026-11-12', '2026-11-13']) fact = applyAnswer(fact, evidence({ localDate }), 1500).fact;
    expect(isFluent(fact)).toBe(false);
    const result = applyAnswer(fact, evidence({ localDate: '2026-11-14' }), 1500);
    expect(result.becameFluent).toBe(true);
    fact = applyAnswer(result.fact, evidence({ localDate: '2026-11-15' }), 1500).fact;
    expect(fact.fastDays).toEqual(['2026-11-13', '2026-11-14', '2026-11-15']);
    expect(isFluent({ ...fact, stage: 'learning' })).toBe(false);
  });
  it('confirms provisional facts individually, or lapses them', () => {
    const fact: FactState = { ...newFactState('x'), stage: 'review', provisional: true, dueAt: 0 };
    expect(applyAnswer(fact, evidence(), 1500).fact).toMatchObject({ stage: 'review', provisional: false, ladder: 1, dueAt: 1000 + 3 * DAY_MS });
    expect(applyAnswer(fact, evidence({ correct: false }), 1500).fact).toMatchObject({ stage: 'learning', provisional: false, lapses: 1 });
  });
});

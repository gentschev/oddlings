import { describe, expect, it } from 'vitest';
import {
  BLOCKED_WINDOW, DAY_MS, FACT_SETS, getFact, getSet, introductionSets, isBlocked, learningWindowSize,
  logResponse, planEncounter, seededRandom, setLevel,
} from '../../src/core';
import { fixture, masterSet, masterThrough } from './helpers';

describe('ordinary encounter planning after entry checks', () => {
  it('is seeded, pure, defaults to eight slots and accepts only lengths six to ten', () => {
    const save = fixture(); const before = structuredClone(save);
    const result = planEncounter(save, 0, seededRandom(123));
    expect(result).toHaveLength(8);
    expect(result).toEqual(planEncounter(save, 0, seededRandom(123)));
    expect(save).toEqual(before);
    expect(result).not.toEqual(planEncounter(save, 0, seededRandom(456)));
    for (const length of [6, 7, 9, 10]) expect(planEncounter(save, 0, seededRandom(1), length)).toHaveLength(length);
    for (const length of [5, 11, 6.5]) expect(() => planEncounter(save, 0, seededRandom(1), length)).toThrow();
  });
  it('starts with only the earliest available set and limits new introductions to the window', () => {
    const save = fixture();
    const result = planEncounter(save, 0, seededRandom(123));
    expect(new Set(result.map(s => s.setId))).toEqual(new Set(['see-dots']));
    expect(new Set(result.map(s => s.factId)).size).toBeLessThanOrEqual(3);
    expect(result.every(s => s.mode === 'modeled')).toBe(true);
    for (const set of FACT_SETS) {
      expect(introductionSets(save).length).toBeLessThanOrEqual(2);
      expect(introductionSets(save).some(s => s.id === set.id) || setLevel(save, set.id) >= 2, set.id).toBe(true);
      masterSet(save, set.id);
    }
  });
  it.each([[11, 0.7, 3], [12, 0.74, 2], [12, 0.75, 3], [12, 0.9, 3], [12, 0.91, 4]])('sizes the window at %s answers and %s accuracy', (questions, accuracy, size) => {
    const save = fixture(); Object.assign(save.sessions[0]!, { questions, accuracy });
    expect(learningWindowSize(save)).toBe(size);
  });
  it('does not introduce another fact while learning is full', () => {
    const save = fixture();
    for (const id of getSet('see-dots').facts.slice(0, 3)) save.facts[id]!.stage = 'learning';
    expect(planEncounter(save, 0, seededRandom(1)).every(s => s.source !== 'new')).toBe(true);
  });
  it('prioritises oldest due reviews, caps them at sixty percent and keeps seventy percent known', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    const ids = getSet('see-dots').facts;
    ids.slice(0, 5).forEach((id, i) => save.facts[id]!.dueAt = -1000 + i);
    const plan = planEncounter(save, 0, seededRandom(1), 10);
    expect(plan[0]!.factId).toBe(ids[0]);
    expect(plan.filter(s => s.source === 'due').length).toBeLessThanOrEqual(6);
    expect(plan.filter(s => save.facts[s.factId]!.stage === 'review').length).toBeGreaterThanOrEqual(7);
    expect(save.facts[plan[0]!.factId]!.stage).toBe('review');
    expect(save.facts[plan.at(-1)!.factId]!.stage).toBe('review');
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.factId).not.toBe(plan[i - 1]!.factId);
      expect(getFact(plan[i]!.factId).answer).not.toBe(getFact(plan[i - 1]!.factId).answer);
    }
  });
  it('chooses not-due filler in least-recently-seen order and always allows play after mastery', () => {
    const save = fixture();
    for (const set of FACT_SETS) masterSet(save, set.id);
    Object.values(save.facts).forEach((f, i) => { f.lastSeenAt = i; f.dueAt = DAY_MS; });
    const oldest = Object.values(save.facts).sort((a, b) => a.lastSeenAt! - b.lastSeenAt!)[0]!;
    const plan = planEncounter(save, 0, seededRandom(1));
    expect(plan[0]!.factId).toBe(oldest.id);
    expect(plan.every(s => s.source === 'known')).toBe(true);
  });
  it('blocks new sets until ten showings reach eighty percent, then keeps the interleave latch', () => {
    const save = fixture();
    for (let i = 0; i < BLOCKED_WINDOW; i++) logResponse(save, { factId: 'dots:1:dice', time: i,
      correct: i >= 2, firstTryCorrect: i >= 2, neededHelp: false, latency: 1000, mode: 'plain', score: i >= 2 ? 1 : 0,
      encounterId: 'a', setId: 'see-dots' }, false, false);
    expect(isBlocked(save, 'see-dots')).toBe(false);
    expect(save.practice.setHistory['see-dots']).toHaveLength(10);
    logResponse(save, { ...save.responses[0]!, firstTryCorrect: false }, false, false);
    expect(isBlocked(save, 'see-dots')).toBe(false);
  });
  it('mixes addition with subtraction once the inverse is available', () => {
    const save = fixture(); masterThrough(save, 'sub-minus01');
    save.practice.interleaved.push('add-plus2');
    const plan = planEncounter(save, 0, seededRandom(1));
    expect(plan.some(s => getFact(s.factId).operation === 'add')).toBe(true);
    expect(plan.some(s => getFact(s.factId).operation === 'sub')).toBe(true);
    expect(plan.some(s => s.source === 'new')).toBe(true);
  });
  it('can play when all reviews are due, even when there is no resting pool', () => {
    const save = fixture();
    for (const set of FACT_SETS) masterSet(save, set.id, -DAY_MS);
    const plan = planEncounter(save, 0, seededRandom(1));
    expect(plan).toHaveLength(8);
    expect(new Set(plan.map(s => s.factId)).size).toBe(8);
  });
  it('stores overlapping facts once and derives set level from that shared state', () => {
    const save = fixture(); masterSet(save, 'add-within10');
    expect(setLevel(save, 'add-within5')).toBe(2);
    expect(save.facts['add:2+3']!.seen).toBe(3);
  });
});

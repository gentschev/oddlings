import { describe, expect, it } from 'vitest';
import { createSave, currentSlot, entryCheck, exportSave, FACT_SETS, getFact, getSet, hardestFirst, importSave, placementProbes,
  placementSlot, provisionalFacts, recordPlacement, recordSetStreak, seededRandom, setPassed, startEncounter, startSession,
  submitAnswer, tickEntryGap, type Response } from '../../src/core';
import { masterSet } from './helpers';

const rng = () => seededRandom(7);
function fresh(set = 'see-dots') {
  const save = createSave(); startSession(save, 0);
  for (const s of FACT_SETS) { if (s.id === set) break; masterSet(save, s.id); }
  return save;
}
function response(factId: string, overrides: Partial<Response> = {}): Response {
  return { factId, setId: 'add-plus0', time: 1000, correct: true, firstTryCorrect: true,
    neededHelp: false, latency: 1200, mode: 'plain', score: 1, encounterId: 'a', ...overrides };
}
describe('entry checks per set', () => {
  it('chooses two hardest plain probes without consuming randomness and passes upward in one encounter', () => {
    const save = fresh('see-frame'), random = rng(), state = random.state();
    expect(placementProbes(save, random)).toEqual(['frame:10', 'frame:9']); expect(random.state()).toBe(state);
    expect(placementSlot(save, random, 0, 0)?.mode).toBe('plain');
    for (const id of placementProbes(save, random)) recordPlacement(save, id, true, 0);
    expect(setPassed(save, 'see-frame')).toBe(true);
    expect(entryCheck(save)?.setId).toBe('add-plus0');
    expect(save.facts['frame:10']).toMatchObject({ stage: 'review', provisional: false });
    expect(save.facts['frame:1']).toMatchObject({ stage: 'review', provisional: true });
    expect([...getSet('add-plus1').facts].sort(hardestFirst).slice(0, 2).every(id => getFact(id).answer >= 10)).toBe(true);
  });
  it.each([false, true])('gives a delayed, different recheck after a slip on probe two: %s', second => {
    const save = fresh(), random = rng(), e = startEncounter(save, 0, random);
    if (second) submitAnswer(save, e, getFact(currentSlot(e).factId).answer, e.shownAt + 1000, 'day', random);
    const missed = currentSlot(e).factId;
    submitAnswer(save, e, 99, e.shownAt + 1000, 'day', random);
    expect(e.phase).toBe('correction'); expect(save.facts[missed]!.stage).toBe('learning');
    submitAnswer(save, e, getFact(missed).answer, e.shownAt + 1000, 'day', random);
    let gap = 0;
    while (currentSlot(e).source !== 'placement') {
      expect(++gap).toBeLessThan(8);
      submitAnswer(save, e, getFact(currentSlot(e).factId).answer, e.shownAt + 1000, 'day', random);
    }
    expect(gap).toBeGreaterThanOrEqual(2); expect(currentSlot(e).factId).not.toBe(missed);
    submitAnswer(save, e, getFact(currentSlot(e).factId).answer, e.shownAt + 1000, 'day', random);
    expect(save.practice.checks?.['see-dots']?.status).toBe('passed');
    expect(save.facts[missed]).toMatchObject({ stage: 'learning', provisional: false });
    expect(save.sessions[0]!.retries.some(r => r.factId === missed)).toBe(true);
  });
  it('stops only that set after two misses, leaving later sets their entry checks', () => {
    const save = fresh(), random = rng();
    for (const id of placementProbes(save, random)) recordPlacement(save, id, false, 0);
    expect(entryCheck(save)).toBeUndefined(); expect(save.practice.checks?.['see-dots']?.status).toBe('learning');
    masterSet(save, 'see-dots');
    expect(placementProbes(save, random)).toEqual(['frame:10', 'frame:9']);
  });
  it('preserves a pending gap across saves, encounters and sessions', () => {
    const save = fresh(), random = rng(); recordPlacement(save, placementProbes(save, random)[0]!, false, 0);
    const restored = importSave(exportSave(save)); startSession(restored, 10000);
    expect(entryCheck(restored)?.check.recheckGap).toBe(2);
    expect(placementSlot(restored, random, 0, 0)?.source).not.toBe('placement');
    tickEntryGap(restored); tickEntryGap(restored);
    expect(placementSlot(restored, random, 0, 0)?.source).toBe('placement');
  });
  it('resumes old single-miss checks without letting old stopped checks disable future sets', () => {
    const save = fresh();
    save.practice.placement = { active: false, setIndex: 0, probes: ['dots:5:dice', 'dots:5:scattered'], results: [true, false] };
    const pending = placementProbes(save, rng());
    expect(pending).toHaveLength(1); expect(pending[0]).not.toBe('dots:5:scattered');
    expect(entryCheck(save)?.check.recheckGap).toBe(2);
  });
  it('checks a later set even when shared facts were already seen in an earlier set', () => {
    const save = fresh('add-plus1');
    expect(save.facts['add:0+1']!.seen).toBeGreaterThan(0);
    expect(entryCheck(save)?.setId).toBe('add-plus1');
  });
  it('spreads provisional confirmations in teaching order, at most two per encounter', () => {
    const save = fresh(), random = rng(), e = startEncounter(save, 0, random);
    let confirmations = 0;
    while (e.phase !== 'complete') {
      const slot = currentSlot(e);
      if (save.facts[slot.factId]!.provisional) {
        confirmations++; expect(slot.factId).toBe(provisionalFacts(save)[0]);
      }
      submitAnswer(save, e, getFact(slot.factId).answer, e.shownAt + 1200, 'day', random);
    }
    expect(confirmations).toBeLessThanOrEqual(2); expect(confirmations).toBeGreaterThan(0);
  });
});
describe('independent recall streaks', () => {
  it('passes unseen facts after five different plain recalls, keeps misses learning, and persists evidence', () => {
    const save = fresh('add-plus0'), ids = [...getSet('add-plus0').facts].sort(hardestFirst);
    save.practice.checks = { 'add-plus0': { status: 'learning', probes: ids.slice(0, 2), results: [false, false], recheckGap: 0 } };
    for (const id of ids.slice(0, 2)) Object.assign(save.facts[id]!, { stage: 'learning', seen: 1, firstTryCorrect: 0 });
    for (const id of ids.slice(2, 7)) recordSetStreak(save, response(id));
    expect(save.facts[ids[0]!]!.stage).toBe('learning'); expect(save.facts[ids[1]!]!.stage).toBe('learning');
    expect(save.facts[ids[7]!]!).toMatchObject({ stage: 'review', provisional: true });
    expect(importSave(exportSave(save)).practice.streaks?.['add-plus0']).toHaveLength(5);
    expect(save.facts['add:8+2']!.stage).toBe('new');
  });
  it.each([{ firstTryCorrect: false }, { neededHelp: true }, { mode: 'modeled' as const }])('rejects dependent evidence and resets the streak: %j', overrides => {
    const save = fresh('add-plus0'), ids = getSet('add-plus0').facts;
    for (const id of ids.slice(0, 4)) recordSetStreak(save, response(id));
    recordSetStreak(save, response(ids[4]!, overrides));
    expect(save.practice.streaks?.['add-plus0']).toEqual([]);
    expect(save.facts[ids[5]!]!.stage).toBe('new');
  });
  it('counts a repeated fact once and does not reset for unrelated practice', () => {
    const save = fresh('add-plus0');
    for (let i = 0; i < 8; i++) recordSetStreak(save, response('add:0+0'));
    recordSetStreak(save, response('frame:3', { firstTryCorrect: false }));
    expect(save.practice.streaks?.['add-plus0']).toEqual(['add:0+0']);
    expect(save.facts['add:5+0']!.stage).toBe('new');
  });
  it('does not overwrite a shared missed fact when an overlapping check passes', () => {
    const save = fresh('add-plus1');
    const missed = 'add:0+1'; Object.assign(save.facts[missed]!, { stage: 'learning', seen: 2, firstTryCorrect: 1 });
    for (const id of placementProbes(save, rng())) recordPlacement(save, id, true, 0);
    expect(save.facts[missed]).toMatchObject({ stage: 'learning', provisional: false });
  });
});

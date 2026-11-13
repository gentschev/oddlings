import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyAnswer, createSave, DAY_MS, getSet, knownRatio, newFactState, pathStops, improvingStop, syncPath, seeStory, plainFirst, presentationMode,
  startSession, WINDOW_MIN_ANSWERS, WINDOW_LOW_ACCURACY, WINDOW_HIGH_ACCURACY, MIN_KNOWN_RATIO_HIGH,
  currentSlot, getFact, planEncounter, seededRandom, startEncounter, submitAnswer, setPassed, importSave, exportSave, placementProbes, recordSetStreak, entryCheck } from '../../src/core';
import { PEBBLE_STOPS } from '../../src/core/story/pebblePath';
import { fixture, masterSet } from './helpers';

const evidence = { now: 1000, localDate: 'day', encounterId: 'a', correct: true, hintUsed: false, latency: 1200, hidden: false, mode: 'plain' as const };
describe('plain first and adaptive known share', () => {
  it('uses current accuracy or a previous successful session during the warm start', () => {
    const save = createSave(); startSession(save, 0);
    expect(plainFirst(save)).toBe(false); expect(presentationMode(save, 'add:3+0')).toBe('modeled');
    Object.assign(save.sessions[0]!, { questions: 1, accuracy: WINDOW_LOW_ACCURACY });
    expect(presentationMode(save, 'add:3+0')).toBe('plain');
    startSession(save, 1000); expect(plainFirst(save)).toBe(true);
    Object.assign(save.sessions[1]!, { questions: WINDOW_MIN_ANSWERS - 1, accuracy: 0 });
    expect(plainFirst(save)).toBe(true);
    save.sessions[1]!.questions++; expect(plainFirst(save)).toBe(false);
    expect(presentationMode(save, 'add:3+0', true)).toBe('plain');
  });
  it('uses forty percent known only after enough answers at or above the high threshold', () => {
    const save = fixture(), session = save.sessions[0]!;
    Object.assign(session, { questions: WINDOW_MIN_ANSWERS - 1, accuracy: 1 }); expect(knownRatio(save)).toBe(0.7);
    Object.assign(session, { questions: WINDOW_MIN_ANSWERS, accuracy: WINDOW_HIGH_ACCURACY }); expect(knownRatio(save)).toBe(MIN_KNOWN_RATIO_HIGH);
    session.accuracy = WINDOW_HIGH_ACCURACY - 0.001; expect(knownRatio(save)).toBe(0.7);
    session.accuracy = WINDOW_LOW_ACCURACY - 0.001; expect(knownRatio(save)).toBe(0.7);
  });
  it('applies the adaptive quota to actual plans while keeping known ends', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    Object.assign(save.sessions[0]!, { questions: 12, accuracy: 0.95 });
    const plan = planEncounter(save, 0, seededRandom(4), 10);
    expect(plan.filter(s => save.facts[s.factId]!.stage === 'review')).toHaveLength(4);
    expect(save.facts[plan[0]!.factId]!.stage).toBe('review');
    expect(save.facts[plan.at(-1)!.factId]!.stage).toBe('review');
    save.sessions[0]!.accuracy = 0.74;
    expect(planEncounter(save, 0, seededRandom(4), 10).filter(s => save.facts[s.factId]!.stage === 'review').length).toBeGreaterThanOrEqual(7);
  });
  it('lets independent new checks through a full learning window, while keeping misses modeled', () => {
    const save = fixture(); masterSet(save, 'see-dots');
    for (const id of getSet('see-frame').facts.slice(0, 4)) Object.assign(save.facts[id]!, { stage: 'learning', needsModel: true });
    Object.assign(save.sessions[0]!, { questions: 20, accuracy: 0.95 });
    expect(presentationMode(save, 'frame:0')).toBe('modeled');
    expect(presentationMode(save, 'frame:10')).toBe('plain');
  });
});
describe('direct acquisition from independent recall', () => {
  it('puts a fast new plain answer straight in confirmed review with a day of spacing and fluency evidence', () => {
    const before = newFactState('add:3+0'), result = applyAnswer(before, evidence, 1500);
    expect(result.fact).toMatchObject({ stage: 'review', provisional: false, ladder: 0, dueAt: 1000 + DAY_MS, fastDays: ['day'] });
    expect(result.enteredReview).toBe(true); expect(before.stage).toBe('new');
  });
  it('keeps slow, modeled, hidden and helped new answers on the learning route', () => {
    for (const extra of [{ latency: 6000 }, { mode: 'modeled' as const }, { hidden: true }, { hintUsed: true }]) {
      const result = applyAnswer(newFactState('add:3+0'), { ...evidence, ...extra }, 1500);
      expect(result.fact.stage).toBe('learning');
      expect(result.fact.streak).toBe(extra.hintUsed ? 0 : 1);
    }
  });
  it('logs fast new recall and avoids scheduling a teaching retry for an already confirmed fact', () => {
    const save = createSave(); startSession(save, 0); const random = seededRandom(8), e = startEncounter(save, 0, random);
    const id = currentSlot(e).factId;
    submitAnswer(save, e, getFact(id).answer, 1200, 'day', random);
    expect(save.sessions[0]!.enteredReview).toContain(id); expect(save.facts[id]!.fastDays).toEqual(['day']);
    expect(save.sessions[0]!.retries.some(r => r.factId === id)).toBe(false);
  });
});
it('credits learning streaks without mistaking part credit for passing a set', () => {
  const save = createSave(), ids = getSet('see-dots').facts;
  const progress = () => pathStops(save, 0)[1]!.progress;
  expect(progress()).toBe(0);
  // Ten facts, nine needed. A learning fact counts its streak out of four, capped at three.
  Object.assign(save.facts[ids[0]!]!, { stage: 'learning', streak: 1 }); expect(progress()).toBeCloseTo(1 / 36);
  save.facts[ids[0]!]!.streak = 2; expect(progress()).toBeCloseTo(2 / 36);
  save.facts[ids[0]!]!.streak = 8; expect(progress()).toBeCloseTo(3 / 36);
  Object.assign(save.facts[ids[1]!]!, { stage: 'review', provisional: true }); expect(progress()).toBeCloseTo(7 / 36);
  expect(setPassed(save, 'see-dots')).toBe(false);
});

it('reports progress at the current stop even before a fact reaches review', () => {
  const save = createSave(); seeStory(save, PEBBLE_STOPS[0], 0);
  const before = pathStops(save, 0);
  Object.assign(save.facts['dots:1:dice']!, { stage: 'learning', streak: 1 });
  const change = syncPath(save, 0); change.before = before;
  expect(change.completed).toEqual([]); expect(improvingStop(change)?.pal).toBe('bix');
  change.before = change.after; expect(improvingStop(change)).toBeUndefined();
});

it('fills the ring only when the set is passed, however much part credit there is', () => {
  const save = createSave(), ids = getSet('see-dots').facts;
  for (const id of ids.slice(0, 8)) save.facts[id]!.stage = 'review';
  for (const id of ids.slice(8)) Object.assign(save.facts[id]!, { stage: 'learning', streak: 2, streakEncounters: ['a'] });
  // Eight in review and the best one of the two being learned: (8 + 2/4) / 9.
  expect(pathStops(save, 0)[1]!.progress).toBeCloseTo(8.5 / 9); expect(setPassed(save, 'see-dots')).toBe(false);
  for (const id of ids.slice(8)) save.facts[id] = applyAnswer(save.facts[id]!, evidence, 1500).fact;
  const after = pathStops(save, 0)[1]!.progress;
  expect(after).toBeGreaterThan(8.5 / 9); expect(after).toBeLessThan(1); expect(setPassed(save, 'see-dots')).toBe(false);
  save.facts[ids[8]!]!.stage = 'review';
  expect(pathStops(save, 0)[1]!.progress).toBe(1); expect(setPassed(save, 'see-dots')).toBe(true);
});

it.each([1, 2])('rescues stopped version %s saves without resetting existing evidence', version => {
  const json = readFileSync('tests/fixtures/save-v1-path-cleared.json', 'utf8');
  const save = importSave(version === 1 ? json : exportSave(importSave(json)));
  const facts = structuredClone(save.facts), responses = structuredClone(save.responses);
  startSession(save, save.sessions.at(-1)!.end);
  expect(placementProbes(save, seededRandom(1))).toEqual([]);
  expect(save.facts).toEqual(facts); expect(save.responses).toEqual(responses);
  const ids = getSet('add-plus0').facts.filter(id => save.facts[id]!.stage === 'new').slice(0, 5);
  for (const id of ids) {
    save.facts[id] = applyAnswer(save.facts[id]!, evidence, save.profile.tapBaseline).fact;
    recordSetStreak(save, { factId: id, setId: 'add-plus0', correct: true, firstTryCorrect: true, neededHelp: false,
      time: 1000, mode: 'plain', latency: 1200, score: 1, encounterId: 'a' });
  }
  expect(setPassed(save, 'add-plus0')).toBe(true);
  expect(save.facts['add:0+10']!.stage).toBe('learning');
  expect(entryCheck(save)?.setId).toBe('add-plus1');
  expect(save.responses).toEqual(responses);
});
